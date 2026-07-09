import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  emptyForm,
  FormSchema,
  validateSubmission,
} from "@formbuilder/form-schema";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationsService } from "../automations/automations.service";
import type { AuthUser } from "../auth/current-user.decorator";

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automations: AutomationsService,
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
        _count: { select: { responses: true } },
      },
    });
  }

  async get(user: AuthUser, id: string) {
    const form = await this.prisma.form.findFirst({
      where: { id, workspace: { orgId: user.orgId } },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!form) throw new NotFoundException("Form not found");
    return form;
  }

  create(user: AuthUser, title: string) {
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
    return this.prisma.form.update({
      where: { id },
      data: { title: patch.title, status: patch.status },
    });
  }

  async saveSchema(user: AuthUser, id: string, raw: unknown) {
    const parsed = FormSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Invalid form schema");
    const form = await this.get(user, id);
    const latest = form.versions[0];
    await this.prisma.$transaction([
      this.prisma.formVersion.update({
        where: { id: latest.id },
        data: { schema: parsed.data as unknown as Prisma.InputJsonValue },
      }),
      this.prisma.form.update({
        where: { id },
        data: { title: parsed.data.title || form.title },
      }),
    ]);
    return { ok: true };
  }

  async listResponses(user: AuthUser, id: string) {
    await this.assertOwned(user, id);
    return this.prisma.response.findMany({
      where: { formId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async duplicate(user: AuthUser, id: string) {
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

  async analytics(user: AuthUser, id: string) {
    await this.assertOwned(user, id);
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const [views, starts, submissions, deviceGroups, sourceGroups, viewRows, respRows] =
      await Promise.all([
        this.prisma.event.count({ where: { formId: id, type: "view" } }),
        this.prisma.event.count({ where: { formId: id, type: "start" } }),
        this.prisma.response.count({ where: { formId: id } }),
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
          where: { formId: id, createdAt: { gte: since } },
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
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!form || form.status !== "PUBLISHED") {
      throw new NotFoundException("Form not found");
    }
    return {
      id: form.id,
      title: form.title,
      slug: form.slug,
      schema: form.versions[0]?.schema ?? emptyForm(form.title),
    };
  }

  async submit(slug: string, data: Record<string, unknown>) {
    const form = await this.prisma.form.findUnique({
      where: { slug },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!form || form.status !== "PUBLISHED") {
      throw new NotFoundException("This form is not accepting responses");
    }
    const schema = FormSchema.parse(
      form.versions[0]?.schema ?? emptyForm(form.title),
    );
    let cleaned: Record<string, unknown>;
    try {
      cleaned = validateSubmission(schema, data || {});
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const response = await this.prisma.response.create({
      data: {
        formId: form.id,
        data: cleaned as unknown as Prisma.InputJsonValue,
      },
    });
    // Fire webhooks/automations without blocking the submitter's response.
    void this.automations.dispatch(form.id, {
      formId: form.id,
      slug: form.slug,
      responseId: response.id,
      data: cleaned,
    });
    return { ok: true, id: response.id };
  }

  /* ---------- helpers ---------- */

  private async assertOwned(user: AuthUser, id: string) {
    const f = await this.prisma.form.findFirst({
      where: { id, workspace: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!f) throw new NotFoundException("Form not found");
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
