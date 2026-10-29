import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  buildArtifact,
  draftsProblem,
  formProblems,
  emptyForm,
  formFromTemplate,
  idsFromPrevious,
  normalizeConditions,
  normalizeScores,
  sameContent,
  FormSchema,
} from "@formbuilder/form-schema";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/current-user.decorator";
import { assertCanEdit } from "../auth/can-edit";
import { describeSchemaError } from "../common/schema-errors";
import { TemplatesService } from "../templates/templates.service";

/** Versions are append-only, so a form's current version is its highest `version`. */
const LATEST_VERSION = { orderBy: { version: "desc" }, take: 1 } as const;

/**
 * The download's file name: the title in lower case, each run of anything but
 * a–z and 0–9 as "-", trimmed of "-", then "-v<version>.json". "PHQ-9 (adult)"
 * at version 12 is "phq-9-adult-v12.json"; a title that leaves nothing gives
 * "form-v12.json".
 */
function downloadFileName(title: string, version: number): string {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${stem || "form"}-v${version}.json`;
}

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
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
        createdAt: true,
        updatedAt: true,
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
    this.assertCanEdit(user);
    return this.prisma.form.create({
      data: {
        title,
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
    this.assertCanEdit(user);
    const form = await this.get(user, id);
    const source = await this.prisma.formVersion.findFirst({
      where: { id: versionId, formId: form.id },
    });
    if (!source) throw new NotFoundException("Version not found");
    // A version saved before condition ids and logic text gets them now (contract §15.6),
    // and its scores their ids, names and trees (§17.9).
    const restored = FormSchema.parse(source.schema);
    const current = FormSchema.safeParse(form.versions[0]?.schema);
    const previous = current.success ? current.data.blocks : [];
    const created = await this.appendVersion(
      form,
      { ...restored, blocks: normalizeScores(normalizeConditions(restored.blocks, idsFromPrevious(previous)), previous) },
      `Restored from v${source.version}`,
    );
    return { ok: true, versionId: created.id, version: created.version };
  }

  async saveSchema(user: AuthUser, id: string, raw: unknown) {
    this.assertCanEdit(user);
    const parsed = FormSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(describeSchemaError(raw, parsed.error));
    const form = await this.get(user, id);
    // Conditions get their ids and items their logic text before anything is
    // checked (contract §15.6): the text is the logic, and any tree or
    // enableBehavior sent with it is dropped. A condition sent without an id
    // keeps the one it already has, so re-sending the same content is no change.
    const current = FormSchema.safeParse(form.versions[0]?.schema);
    const previous = current.success ? current.data.blocks : [];
    // Scores the same way (contract §17.7–§17.9): a score sent without an id gets
    // one (the one it has, if re-sent), questions within reach of a scored group
    // get names, and each formula's tree comes from its text — a tree sent with
    // text is ignored, and a tree sent without text gets text made from it.
    const content: FormSchema = {
      ...parsed.data,
      blocks: normalizeScores(normalizeConditions(parsed.data.blocks, idsFromPrevious(previous)), previous),
    };
    // Structure (unique ids, labelled non-empty groups) and conditional logic
    // (sources earlier in reading order, of a usable type, with valid operators
    // and answers) across the whole tree — the same rules the editor checks inline.
    const problems = formProblems(content);
    if (problems.length) {
      const more = problems.length > 1 ? ` (+${problems.length - 1} more)` : "";
      throw new BadRequestException(problems[0].message + more);
    }
    // Form-level settings: "server" drafts need pages (drafts contract §2).
    const draftsIssue = draftsProblem(content);
    if (draftsIssue) throw new BadRequestException(draftsIssue);
    const created = await this.appendVersion(form, content);
    // The content as stored: empty option codes are filled and labels trimmed by the
    // parse (contract §13.3), and conditions have their ids and logic text
    // (§15.6), so the editor adopts these rather than what it sent.
    return { ok: true, versionId: created.id, version: created.version, schema: content };
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
    return { fileName: downloadFileName(artifact.title, current.version), artifact };
  }

  async duplicate(user: AuthUser, id: string) {
    this.assertCanEdit(user);
    const form = await this.get(user, id);
    const schema = form.versions[0]?.schema ?? emptyForm(form.title);
    const title = `${form.title} (copy)`;
    return this.prisma.form.create({
      data: {
        title,
        workspaceId: user.workspaceId,
        versions: {
          create: { version: 1, schema: schema as unknown as Prisma.InputJsonValue },
        },
      },
    });
  }

  /**
   * A new form from a form template, as a blank form is made but with the
   * template's content: fresh block ids, and `templateRef` naming the template
   * and the version used. Nothing else of the template carries over.
   */
  async createFromTemplate(user: AuthUser, templateId: unknown) {
    if (typeof templateId !== "string" || !templateId) throw new BadRequestException("templateId must be a template id.");
    const template = await this.templates.formTemplate(user, templateId);
    return this.createWithSchema(user, formFromTemplate(template));
  }

  async createWithSchema(user: AuthUser, schema: unknown) {
    this.assertCanEdit(user);
    const parsed = FormSchema.parse(schema);
    return this.prisma.form.create({
      data: {
        title: parsed.title,
        workspaceId: user.workspaceId,
        versions: {
          create: { version: 1, schema: parsed as unknown as Prisma.InputJsonValue },
        },
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.assertOwned(user, id);
    this.assertCanEdit(user);
    await this.prisma.form.delete({ where: { id } });
    return { ok: true };
  }

  /* ---------- helpers ---------- */

  private async assertOwned(user: AuthUser, id: string) {
    const f = await this.prisma.form.findFirst({
      where: { id, workspace: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!f) throw new NotFoundException("Form not found");
  }

  /** Viewers can read everything in the org but never mutate. */
  private assertCanEdit(user: AuthUser) {
    assertCanEdit(user);
  }
}
