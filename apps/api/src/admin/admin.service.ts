import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AdminActor } from "./admin.guard";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /* ---------- overview ---------- */

  async overview() {
    const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);
    const [orgs, users, forms, responses, userRows, recentOrgs] =
      await Promise.all([
        this.prisma.organization.count(),
        this.prisma.user.count(),
        this.prisma.form.count(),
        this.prisma.response.count(),
        this.prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
        this.prisma.organization.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, name: true, status: true, createdAt: true },
        }),
      ]);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const index: Record<string, number> = {};
    const signups: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      index[dayKey(d)] = signups.length;
      signups.push({ date: dayKey(d), count: 0 });
    }
    for (const u of userRows) {
      const k = index[dayKey(u.createdAt)];
      if (k !== undefined) signups[k].count++;
    }

    return {
      totals: { orgs, users, forms, responses },
      signups,
      recentOrgs,
    };
  }

  /* ---------- tenants (organizations) ---------- */

  async listOrgs(q?: string) {
    const where: Prisma.OrganizationWhereInput = q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }
      : {};
    const orgs = await this.prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        _count: { select: { memberships: true, workspaces: true } },
      },
    });
    const ids = orgs.map((o) => o.id);
    const formCounts = await this.prisma.form.groupBy({
      by: ["workspaceId"],
      where: { workspace: { orgId: { in: ids } } },
      _count: { _all: true },
    });
    // map workspaceId -> orgId
    const wsToOrg = await this.prisma.workspace.findMany({
      where: { orgId: { in: ids } },
      select: { id: true, orgId: true },
    });
    const orgForms: Record<string, number> = {};
    const wsOrg: Record<string, string> = {};
    for (const w of wsToOrg) wsOrg[w.id] = w.orgId;
    for (const fc of formCounts) {
      const oid = wsOrg[fc.workspaceId];
      if (oid) orgForms[oid] = (orgForms[oid] || 0) + fc._count._all;
    }
    return orgs.map((o) => ({ ...o, forms: orgForms[o.id] || 0 }));
  }

  async getOrg(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        anthropicApiKey: true,
        memberships: {
          select: {
            role: true,
            user: { select: { id: true, email: true, name: true, status: true } },
          },
        },
        workspaces: { select: { id: true } },
      },
    });
    if (!org) throw new NotFoundException("Organization not found");
    const wsIds = org.workspaces.map((w) => w.id);
    const [forms, responses] = await Promise.all([
      this.prisma.form.findMany({
        where: { workspaceId: { in: wsIds } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          createdAt: true,
          _count: { select: { responses: true } },
        },
      }),
      this.prisma.response.count({ where: { form: { workspaceId: { in: wsIds } } } }),
    ]);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      createdAt: org.createdAt,
      hasAiKey: !!org.anthropicApiKey,
      members: org.memberships.map((m) => ({ role: m.role, ...m.user })),
      forms,
      responses,
    };
  }

  async updateOrg(actor: AdminActor, id: string, dto: { status?: string }) {
    const org = await this.prisma.organization.findUnique({ where: { id }, select: { status: true } });
    if (!org) throw new NotFoundException("Organization not found");
    const data: { status?: string } = {};
    if (dto.status && ["active", "suspended"].includes(dto.status)) data.status = dto.status;
    const updated = await this.prisma.organization.update({ where: { id }, data });
    if (data.status && data.status !== org.status)
      await this.audit(actor, `org.${data.status === "suspended" ? "suspended" : "reactivated"}`, "org", id, {});
    return { id: updated.id, status: updated.status };
  }

  /* ---------- users ---------- */

  async listUsers(q?: string) {
    const where: Prisma.UserWhereInput = q
      ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }
      : {};
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        status: true,
        createdAt: true,
        memberships: { select: { role: true, org: { select: { id: true, name: true } } } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isAdmin: u.isAdmin,
      status: u.status,
      createdAt: u.createdAt,
      orgs: u.memberships.map((m) => ({ id: m.org.id, name: m.org.name, role: m.role })),
    }));
  }

  async updateUser(actor: AdminActor, id: string, dto: { status?: string; isAdmin?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { status: true, isAdmin: true } });
    if (!user) throw new NotFoundException("User not found");
    const data: { status?: string; isAdmin?: boolean } = {};
    if (dto.status && ["active", "suspended"].includes(dto.status)) data.status = dto.status;
    if (typeof dto.isAdmin === "boolean") {
      if (id === actor.id && dto.isAdmin === false)
        throw new BadRequestException("You can't remove your own admin access.");
      data.isAdmin = dto.isAdmin;
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    if (data.status && data.status !== user.status)
      await this.audit(actor, `user.${data.status === "suspended" ? "suspended" : "reactivated"}`, "user", id, {});
    if (data.isAdmin !== undefined && data.isAdmin !== user.isAdmin)
      await this.audit(actor, data.isAdmin ? "user.granted_admin" : "user.revoked_admin", "user", id, {});
    return { id: updated.id, status: updated.status, isAdmin: updated.isAdmin };
  }

  async deleteUser(actor: AdminActor, id: string) {
    if (id === actor.id) throw new BadRequestException("You can't delete your own account here.");
    const user = await this.prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!user) throw new NotFoundException("User not found");
    await this.prisma.user.delete({ where: { id } });
    await this.audit(actor, "user.deleted", "user", id, { email: user.email });
    return { ok: true };
  }

  /** Issue a token that logs the admin in as the target user (for support). */
  async impersonate(actor: AdminActor, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        memberships: { take: 1, select: { orgId: true, org: { select: { workspaces: { take: 1, select: { id: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    const m = user.memberships[0];
    if (!m || !m.org.workspaces[0]) throw new BadRequestException("User has no workspace to impersonate.");
    const token = this.jwt.sign(
      { sub: user.id, email: user.email, orgId: m.orgId, workspaceId: m.org.workspaces[0].id, impersonatedBy: actor.id },
      { expiresIn: "1h" },
    );
    await this.audit(actor, "user.impersonated", "user", id, { email: user.email });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }

  /* ---------- forms (cross-tenant moderation) ---------- */

  async listForms(q?: string) {
    const where: Prisma.FormWhereInput = q
      ? { title: { contains: q, mode: "insensitive" } }
      : {};
    const forms = await this.prisma.form.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: { select: { responses: true } },
        workspace: { select: { org: { select: { id: true, name: true } } } },
      },
    });
    return forms.map((f) => ({
      id: f.id,
      title: f.title,
      createdAt: f.createdAt,
      responses: f._count.responses,
      org: f.workspace.org,
    }));
  }

  async deleteForm(actor: AdminActor, id: string) {
    const form = await this.prisma.form.findUnique({ where: { id }, select: { title: true } });
    if (!form) throw new NotFoundException("Form not found");
    await this.prisma.form.delete({ where: { id } });
    await this.audit(actor, "form.deleted", "form", id, { title: form.title });
    return { ok: true };
  }

  /* ---------- audit ---------- */

  async listAudit() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  }

  private async audit(
    actor: AdminActor,
    action: string,
    targetType: string,
    targetId: string,
    meta: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action,
          targetType,
          targetId,
          meta: meta as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* audit best-effort */
    }
  }
}
