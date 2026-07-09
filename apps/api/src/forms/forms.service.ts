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

  /* ---------- public (form runtime, unauthenticated) ---------- */

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
