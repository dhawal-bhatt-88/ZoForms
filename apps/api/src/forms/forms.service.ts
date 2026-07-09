import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FormStatus, Prisma } from "@prisma/client";
import {
  emptyForm,
  FormSchema,
  validateSubmission,
} from "@formbuilder/form-schema";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.form.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
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

  async get(id: string) {
    const form = await this.prisma.form.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!form) throw new NotFoundException("Form not found");
    return form;
  }

  async create(title: string) {
    const workspace = await this.ensureWorkspace();
    const slug = this.slugify(title);
    return this.prisma.form.create({
      data: {
        title,
        slug,
        status: "DRAFT",
        workspaceId: workspace.id,
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
    id: string,
    patch: { title?: string; status?: FormStatus },
  ) {
    await this.assertExists(id);
    return this.prisma.form.update({
      where: { id },
      data: { title: patch.title, status: patch.status },
    });
  }

  /** Persist the editor's working schema onto the latest version, syncing the title. */
  async saveSchema(id: string, raw: unknown) {
    const parsed = FormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException("Invalid form schema");
    }
    const form = await this.get(id);
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

  listResponses(id: string) {
    return this.prisma.response.findMany({
      where: { formId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /** Public: fetch a published form's schema by slug (for the runtime). */
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

  /** Public: accept a submission for a published form. */
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
    return { ok: true, id: response.id };
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

  private async assertExists(id: string) {
    const f = await this.prisma.form.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!f) throw new NotFoundException("Form not found");
  }

  /** Scaffold convenience: guarantee a demo org + workspace exist so "New form" just works. */
  private async ensureWorkspace() {
    const existing = await this.prisma.workspace.findFirst();
    if (existing) return existing;
    const org = await this.prisma.organization.create({
      data: {
        name: "Demo Org",
        slug: "demo-" + Math.random().toString(36).slice(2, 8),
        workspaces: { create: { name: "My Workspace" } },
      },
      include: { workspaces: true },
    });
    return org.workspaces[0];
  }
}
