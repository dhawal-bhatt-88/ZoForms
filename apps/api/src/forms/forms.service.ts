import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  buildArtifact,
  describeBlockPath,
  draftsProblem,
  formProblems,
  emptyForm,
  sameContent,
  FormSchema,
  STATIC_TYPES,
  validateSubmission,
} from "@formbuilder/form-schema";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationsService } from "../automations/automations.service";
import { MailService } from "../mail/mail.service";
import { SearchService } from "../search/search.service";
import { assertFormQuota } from "../billing/billing.service";
import { env } from "../config/env";
import type { AuthUser } from "../auth/current-user.decorator";

/** Versions are append-only, so a form's current version is its highest `version`. */
const LATEST_VERSION = { orderBy: { version: "desc" }, take: 1 } as const;

type RawBlock = { type?: unknown; label?: unknown; title?: unknown; blocks?: RawBlock[] };

/**
 * Turn the first schema validation issue into a message a person can act on,
 * naming the innermost block it's in by its path — inside a page or group, the
 * question, not the container — the same way the save rules name blocks.
 * Follows the issue's own path (blocks.2.blocks.0…) down the raw input, so it
 * visits one chain of blocks, not the whole tree.
 */
function describeSchemaError(
  raw: unknown,
  error: { issues: { path: (string | number)[]; message: string }[] },
): string {
  const issue = error.issues[0];
  let list = (raw as { blocks?: RawBlock[] } | null)?.blocks;
  const chain: RawBlock[] = [];
  const indices: number[] = [];
  let consumed = 0;
  while (
    issue.path[consumed] === "blocks" &&
    typeof issue.path[consumed + 1] === "number" &&
    Array.isArray(list)
  ) {
    const index = issue.path[consumed + 1] as number;
    const block: RawBlock = list[index] ?? {};
    chain.push(block);
    indices.push(index);
    list = block.blocks;
    consumed += 2;
  }
  if (consumed === 0) {
    return `Invalid form schema${issue.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue.message}`;
  }
  // A matrix's `options` are its rows (contract §13.1); name them as the author sees them.
  const rest = issue.path.slice(consumed).map((step, k) =>
    k === 0 && step === "options" && chain[chain.length - 1]?.type === "matrix" ? "rows" : step,
  );
  const where = rest.length ? ` (${rest.join(".")})` : "";
  return `${describeBlockPath(chain, indices)}${where}: ${issue.message}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automations: AutomationsService,
    private readonly mail: MailService,
    private readonly search: SearchService,
  ) {}

  /* ---------- authenticated (scoped to the user's org) ---------- */

  list(user: AuthUser) {
    return this.prisma.form.findMany({
      where: { workspace: { orgId: user.orgId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { responses: true } },
      },
    });
  }

  async get(user: AuthUser, id: string) {
    const form = await this.prisma.form.findFirst({
      where: { id, workspace: { orgId: user.orgId } },
      include: { versions: LATEST_VERSION },
    });
    if (!form) throw new NotFoundException("Form not found");
    return form;
  }

  async create(user: AuthUser, title: string) {
    await this.assertCanEdit(user);
    await assertFormQuota(this.prisma, user.orgId);
    return this.prisma.form.create({
      data: {
        title,
        slug: this.slugify(title),
        status: "DRAFT",
        workspaceId: user.workspaceId,
        versions: {
          create: {
            version: 1,
            schema: emptyForm(title) as unknown as Prisma.InputJsonValue,
          },
        },
      },
    });
  }

  async update(
    user: AuthUser,
    id: string,
    patch: { title?: string; status?: Prisma.FormUpdateInput["status"] },
  ) {
    await this.assertOwned(user, id);
    await this.assertCanEdit(user);
    return this.prisma.form.update({
      where: { id },
      data: { title: patch.title, status: patch.status },
    });
  }

  /* ---------- versions ---------- */

  /**
   * Insert `content` as the form's next version. Versions are append-only: this
   * never updates an existing row. Content identical to the current version is
   * rejected, so a save can't mint an empty version.
   */
  private async appendVersion(
    form: { id: string; title: string; versions: { version: number; schema: Prisma.JsonValue }[] },
    content: FormSchema,
    label?: string,
  ) {
    const current = form.versions[0];
    if (current && sameContent(current.schema, content)) {
      throw new ConflictException({ message: "No changes to save.", code: "NO_CHANGES" });
    }
    try {
      const [created] = await this.prisma.$transaction([
        this.prisma.formVersion.create({
          data: {
            formId: form.id,
            version: (current?.version ?? 0) + 1,
            schema: content as unknown as Prisma.InputJsonValue,
            label,
          },
        }),
        this.prisma.form.update({
          where: { id: form.id },
          data: { title: content.title || form.title },
        }),
      ]);
      return created;
    } catch (e) {
      // A concurrent save claimed this version number first (@@unique([formId, version])).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException({
          message: "This form was saved elsewhere. Reload to get the latest version.",
          code: "VERSION_CONFLICT",
        });
      }
      throw e;
    }
  }

  async listVersions(user: AuthUser, id: string) {
    await this.assertOwned(user, id);
    return this.prisma.formVersion.findMany({
      where: { formId: id },
      orderBy: { version: "desc" },
      select: { id: true, version: true, label: true, createdAt: true },
    });
  }

  /** Restore by appending an old version's content as a new version; no row is modified. */
  async restoreVersion(user: AuthUser, id: string, versionId: string) {
    await this.assertCanEdit(user);
    const form = await this.get(user, id);
    const source = await this.prisma.formVersion.findFirst({
      where: { id: versionId, formId: form.id },
    });
    if (!source) throw new NotFoundException("Version not found");
    const created = await this.appendVersion(
      form,
      FormSchema.parse(source.schema),
      `Restored from v${source.version}`,
    );
    return { ok: true, versionId: created.id, version: created.version };
  }

  async saveSchema(user: AuthUser, id: string, raw: unknown) {
    await this.assertCanEdit(user);
    const parsed = FormSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(describeSchemaError(raw, parsed.error));
    // Structure (unique ids, labelled non-empty groups) and conditional logic
    // (sources earlier in reading order, of a usable type, with valid operators
    // and answers) across the whole tree — the same rules the editor checks inline.
    const problems = formProblems(parsed.data);
    if (problems.length) {
      const more = problems.length > 1 ? ` (+${problems.length - 1} more)` : "";
      throw new BadRequestException(problems[0].message + more);
    }
    // Form-level settings: "server" drafts need pages (drafts contract §2).
    const draftsIssue = draftsProblem(parsed.data);
    if (draftsIssue) throw new BadRequestException(draftsIssue);
    const form = await this.get(user, id);
    const created = await this.appendVersion(form, parsed.data);
    // The content as stored: empty option codes are filled and labels trimmed by the
    // parse (contract §13.3), so the editor adopts these rather than what it sent.
    return { ok: true, versionId: created.id, version: created.version, schema: parsed.data };
  }

  /**
   * The export artifact for the form's current version. A pure read: it writes
   * nothing, so downloading can never create or alter a version.
   */
  async getArtifact(user: AuthUser, id: string) {
    const form = await this.get(user, id);
    const current = form.versions[0];
    if (!current) throw new NotFoundException("Form has no saved version");
    // Identity, schema format and navigation are stamped by buildArtifact, never
    // stored in or read from the schema itself.
    const artifact = buildArtifact(current.schema, { formId: form.id, formVersionId: current.id });
    return { fileName: `${form.slug}-schema.json`, artifact };
  }

  async listResponses(user: AuthUser, id: string, q?: string) {
    await this.assertOwned(user, id);
    if (q && q.trim()) {
      return this.search.search(id, q);
    }
    return this.prisma.response.findMany({
      where: { formId: id, partial: false },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async duplicate(user: AuthUser, id: string) {
    await this.assertCanEdit(user);
    await assertFormQuota(this.prisma, user.orgId);
    const form = await this.get(user, id);
    const schema = form.versions[0]?.schema ?? emptyForm(form.title);
    const title = `${form.title} (copy)`;
    return this.prisma.form.create({
      data: {
        title,
        slug: this.slugify(title),
        status: "DRAFT",
        workspaceId: user.workspaceId,
        versions: {
          create: { version: 1, schema: schema as unknown as Prisma.InputJsonValue },
        },
      },
    });
  }

  async createWithSchema(user: AuthUser, schema: unknown) {
    await this.assertCanEdit(user);
    await assertFormQuota(this.prisma, user.orgId);
    const parsed = FormSchema.parse(schema);
    return this.prisma.form.create({
      data: {
        title: parsed.title,
        slug: this.slugify(parsed.title),
        status: "DRAFT",
        workspaceId: user.workspaceId,
        versions: {
          create: { version: 1, schema: parsed as unknown as Prisma.InputJsonValue },
        },
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.assertOwned(user, id);
    await this.assertCanEdit(user);
    await this.prisma.form.delete({ where: { id } });
    return { ok: true };
  }

  async analytics(user: AuthUser, id: string) {
    await this.assertOwned(user, id);
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const [views, starts, submissions, deviceGroups, sourceGroups, viewRows, respRows] =
      await Promise.all([
        this.prisma.event.count({ where: { formId: id, type: "view" } }),
        this.prisma.event.count({ where: { formId: id, type: "start" } }),
        this.prisma.response.count({ where: { formId: id, partial: false } }),
        this.prisma.event.groupBy({
          by: ["device"],
          where: { formId: id, type: "view" },
          _count: { _all: true },
        }),
        this.prisma.event.groupBy({
          by: ["source"],
          where: { formId: id, type: "view" },
          _count: { _all: true },
        }),
        this.prisma.event.findMany({
          where: { formId: id, type: "view", createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.response.findMany({
          where: { formId: id, partial: false, createdAt: { gte: since } },
          select: { createdAt: true },
        }),
      ]);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const days: { date: string; views: number; submissions: number }[] = [];
    const index: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = dayKey(d);
      index[key] = days.length;
      days.push({ date: key, views: 0, submissions: 0 });
    }
    for (const r of viewRows) {
      const k = index[dayKey(r.createdAt)];
      if (k !== undefined) days[k].views++;
    }
    for (const r of respRows) {
      const k = index[dayKey(r.createdAt)];
      if (k !== undefined) days[k].submissions++;
    }

    const byDevice = { desktop: 0, mobile: 0, tablet: 0 } as Record<string, number>;
    for (const g of deviceGroups) byDevice[g.device || "desktop"] = g._count._all;
    const bySource = sourceGroups
      .map((g) => ({ source: g.source || "direct", count: g._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      views,
      starts,
      submissions,
      completionRate: views > 0 ? Math.round((submissions / views) * 100) : 0,
      startRate: views > 0 ? Math.round((starts / views) * 100) : 0,
      byDevice,
      bySource,
      daily: days,
    };
  }

  /* ---------- public (form runtime, unauthenticated) ---------- */

  async track(slug: string, type: string, source: string | undefined, userAgent: string) {
    if (type !== "view" && type !== "start") return { ok: false };
    const form = await this.prisma.form.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!form || form.status !== "PUBLISHED") return { ok: false };
    const ua = userAgent || "";
    const device = /iPad|Tablet/i.test(ua)
      ? "tablet"
      : /Mobi|Android|iPhone/i.test(ua)
        ? "mobile"
        : "desktop";
    let src = "direct";
    if (source) {
      try {
        src = new URL(source).hostname || "direct";
      } catch {
        src = source.slice(0, 60);
      }
    }
    await this.prisma.event.create({ data: { formId: form.id, type, device, source: src } });
    return { ok: true };
  }

  async getPublicBySlug(slug: string) {
    const form = await this.prisma.form.findUnique({
      where: { slug },
      include: {
        versions: LATEST_VERSION,
        workspace: { select: { org: { select: { brandingHidden: true } } } },
      },
    });
    if (!form || form.status !== "PUBLISHED") {
      throw new NotFoundException("Form not found");
    }
    return {
      id: form.id,
      title: form.title,
      slug: form.slug,
      schema: form.versions[0]?.schema ?? emptyForm(form.title),
      // White-label: hide the "Made with Frame" footer for Pro+ orgs that opt in.
      branding: !form.workspace.org.brandingHidden,
    };
  }

  /** Store an in-progress (partial) submission, keyed by a client session id. */
  async savePartial(slug: string, sessionId: string, data: Record<string, unknown>) {
    if (!sessionId) throw new BadRequestException("Missing session.");
    const form = await this.prisma.form.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!form || form.status !== "PUBLISHED") {
      throw new NotFoundException("This form is not accepting responses");
    }
    await this.prisma.response.upsert({
      where: { formId_sessionId: { formId: form.id, sessionId } },
      create: {
        formId: form.id,
        sessionId,
        partial: true,
        data: (data || {}) as Prisma.InputJsonValue,
      },
      update: { data: (data || {}) as Prisma.InputJsonValue, partial: true },
    });
    return { ok: true };
  }

  async submit(
    slug: string,
    data: Record<string, unknown>,
    opts?: { sessionId?: string; turnstileToken?: string },
  ) {
    const form = await this.prisma.form.findUnique({
      where: { slug },
      include: { versions: LATEST_VERSION },
    });
    if (!form || form.status !== "PUBLISHED") {
      throw new NotFoundException("This form is not accepting responses");
    }
    const schema = FormSchema.parse(
      form.versions[0]?.schema ?? emptyForm(form.title),
    );
    if (schema.settings?.spamProtection) {
      await this.verifyTurnstile(opts?.turnstileToken);
    }
    let cleaned: Record<string, unknown>;
    try {
      cleaned = validateSubmission(schema, data || {});
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    // If this submitter left a partial trail, complete it in place; else create.
    const sessionId = opts?.sessionId;
    const existingPartial = sessionId
      ? await this.prisma.response.findUnique({
          where: { formId_sessionId: { formId: form.id, sessionId } },
        })
      : null;
    const response = existingPartial
      ? await this.prisma.response.update({
          where: { id: existingPartial.id },
          data: {
            data: cleaned as unknown as Prisma.InputJsonValue,
            partial: false,
            completedAt: new Date(),
          },
        })
      : await this.prisma.response.create({
          data: {
            formId: form.id,
            sessionId: sessionId ?? null,
            partial: false,
            completedAt: new Date(),
            data: cleaned as unknown as Prisma.InputJsonValue,
          },
        });
    // Index for search (no-op without Meilisearch).
    void this.search.index(response);

    // Resolve answers to human labels so Slack/Sheets deliveries read well.
    const fields = schema.blocks
      .filter((b) => !STATIC_TYPES.includes(b.type) && b.id in cleaned)
      .map((b) => ({ label: b.label, value: cleaned[b.id] }));

    // Fire webhooks/automations without blocking the submitter's response.
    void this.automations.dispatch(form.id, {
      formId: form.id,
      formTitle: form.title,
      slug: form.slug,
      responseId: response.id,
      submittedAt: response.createdAt.toISOString(),
      data: cleaned,
      fields,
    });

    // Email the form's notify list (fire-and-forget; never blocks the submit).
    const notifyEmails = schema.settings?.notifyEmails?.filter(Boolean) ?? [];
    if (notifyEmails.length) {
      void this.notifyNewResponse(form.title, form.slug, notifyEmails, fields);
    }
    return { ok: true, id: response.id };
  }

  private async notifyNewResponse(
    formTitle: string,
    slug: string,
    to: string[],
    fields: { label: string; value: unknown }[],
  ) {
    const rows = fields
      .slice(0, 20)
      .map(
        (f) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#6B7280;vertical-align:top">${escapeHtml(
            f.label,
          )}</td><td style="padding:4px 0;color:#1B1D22">${escapeHtml(
            Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? ""),
          )}</td></tr>`,
      )
      .join("");
    const link = `${env.PUBLIC_TENANT_URL.replace(/\/$/, "")}/app`;
    const html = this.mail.layout(
      `New response to “${escapeHtml(formTitle)}”`,
      `<table style="width:100%;border-collapse:collapse;margin-top:6px">${rows}</table>`,
      { label: "View all responses", url: link },
    );
    await this.mail.send({ to, subject: `New response · ${formTitle}`, html }).catch(() => {});
  }

  /* ---------- helpers ---------- */

  private async assertOwned(user: AuthUser, id: string) {
    const f = await this.prisma.form.findFirst({
      where: { id, workspace: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!f) throw new NotFoundException("Form not found");
  }

  /** Verify a Cloudflare Turnstile token. No-op when no secret is configured. */
  private async verifyTurnstile(token: string | undefined) {
    if (!env.TURNSTILE_SECRET) return; // graceful: not enforced until configured
    if (!token) throw new BadRequestException("Please complete the spam check.");
    try {
      const res = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token }),
          signal: AbortSignal.timeout(8000),
        },
      );
      const body = (await res.json()) as { success: boolean };
      if (!body.success) throw new Error();
    } catch {
      throw new BadRequestException("Spam check failed. Please try again.");
    }
  }

  /** Viewers can read everything in the org but never mutate. */
  private async assertCanEdit(user: AuthUser) {
    const m = await this.prisma.membership.findFirst({
      where: { orgId: user.orgId, userId: user.sub },
      select: { role: true },
    });
    if (!m || m.role === "VIEWER") {
      throw new ForbiddenException("Viewers have read-only access.");
    }
  }

  private slugify(title: string) {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40) +
      "-" +
      Math.random().toString(36).slice(2, 7)
    );
  }
}
