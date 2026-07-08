import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { emptyForm } from "@formbuilder/form-schema";
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
    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40) +
      "-" +
      Math.random().toString(36).slice(2, 7);

    return this.prisma.form.create({
      data: {
        title,
        slug,
        status: "DRAFT",
        workspaceId: workspace.id,
        versions: {
          // JSONB form schema — the shared contract from @formbuilder/form-schema
          create: {
            version: 1,
            schema: emptyForm(title) as unknown as Prisma.InputJsonValue,
          },
        },
      },
    });
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
