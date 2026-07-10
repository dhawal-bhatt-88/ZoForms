import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { MailService } from "../mail/mail.service";
import { env } from "../config/env";
import type { AuthUser } from "../auth/current-user.decorator";

const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
const MANAGER_ROLES: Role[] = ["OWNER", "ADMIN"];
const INVITE_TTL_DAYS = 7;

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {}

  /* ---------- members ---------- */

  async members(user: AuthUser) {
    await this.assertMember(user);
    const memberships = await this.prisma.membership.findMany({
      where: { orgId: user.orgId },
      include: { user: { select: { id: true, email: true, name: true, status: true } } },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      status: m.user.status,
      role: m.role,
      isYou: m.userId === user.sub,
      joinedAt: m.createdAt,
    }));
  }

  async setRole(user: AuthUser, targetUserId: string, roleRaw: string) {
    const actor = await this.assertManager(user);
    const role = this.normalizeRole(roleRaw);
    const target = await this.prisma.membership.findFirst({
      where: { orgId: user.orgId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException("Member not found");

    // Only an owner may promote to, or change, an owner.
    if ((role === "OWNER" || target.role === "OWNER") && actor.role !== "OWNER") {
      throw new ForbiddenException("Only an owner can manage owners.");
    }
    // Never leave the org without an owner.
    if (target.role === "OWNER" && role !== "OWNER" && (await this.ownerCount(user.orgId)) <= 1) {
      throw new BadRequestException("Promote another owner before changing the last owner's role.");
    }
    return this.prisma.membership.update({ where: { id: target.id }, data: { role } });
  }

  async removeMember(user: AuthUser, targetUserId: string) {
    const actor = await this.assertManager(user);
    if (targetUserId === user.sub) {
      throw new BadRequestException("You can't remove yourself here.");
    }
    const target = await this.prisma.membership.findFirst({
      where: { orgId: user.orgId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException("Member not found");
    if (target.role === "OWNER" && actor.role !== "OWNER") {
      throw new ForbiddenException("Only an owner can remove an owner.");
    }
    if (target.role === "OWNER" && (await this.ownerCount(user.orgId)) <= 1) {
      throw new BadRequestException("Promote another owner before removing the last one.");
    }
    await this.prisma.membership.delete({ where: { id: target.id } });
    return { ok: true };
  }

  /* ---------- invites ---------- */

  async listInvites(user: AuthUser) {
    await this.assertManager(user);
    return this.prisma.invite.findMany({
      where: { orgId: user.orgId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
  }

  async createInvite(user: AuthUser, dto: { email?: string; role?: string }) {
    const actor = await this.assertManager(user);
    const email = (dto.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException("Enter a valid email address.");
    }
    const role = this.normalizeRole(dto.role || "EDITOR");
    if (role === "OWNER" && actor.role !== "OWNER") {
      throw new ForbiddenException("Only an owner can invite another owner.");
    }
    const alreadyMember = await this.prisma.membership.findFirst({
      where: { orgId: user.orgId, user: { email } },
    });
    if (alreadyMember) throw new BadRequestException("That person is already on your team.");

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
    const invite = await this.prisma.invite.upsert({
      where: { orgId_email: { orgId: user.orgId, email } },
      create: { orgId: user.orgId, email, role, token, invitedById: user.sub, expiresAt },
      update: { role, token, invitedById: user.sub, expiresAt, status: "pending", acceptedAt: null },
    });
    // Send the invite email (no-op without Resend); always return the accept
    // link too so the flow works before email is configured.
    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { name: true },
    });
    const acceptUrl = this.acceptUrl(token);
    void this.mail.send({
      to: email,
      subject: `You're invited to ${org?.name ?? "a team"} on Frame`,
      html: this.mail.layout(
        `Join ${org?.name ?? "the team"} on Frame`,
        `You've been invited as <strong>${role[0] + role.slice(1).toLowerCase()}</strong>. Accept to get started.`,
        { label: "Accept invite", url: acceptUrl },
      ),
    });
    return { invite, acceptUrl };
  }

  async revokeInvite(user: AuthUser, id: string) {
    await this.assertManager(user);
    const invite = await this.prisma.invite.findFirst({ where: { id, orgId: user.orgId } });
    if (!invite) throw new NotFoundException("Invite not found");
    await this.prisma.invite.update({ where: { id }, data: { status: "revoked" } });
    return { ok: true };
  }

  /* ---------- public accept flow ---------- */

  async getInviteByToken(token: string) {
    const invite = await this.loadPendingInvite(token);
    const org = await this.prisma.organization.findUnique({
      where: { id: invite.orgId },
      select: { name: true },
    });
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    });
    return {
      email: invite.email,
      role: invite.role,
      orgName: org?.name ?? "a team",
      needsAccount: !existingUser,
    };
  }

  /** Accept an invite: create the account if needed, join the org, log in. */
  async acceptInvite(token: string, dto: { password?: string; name?: string }) {
    const invite = await this.loadPendingInvite(token);
    const password = dto.password || "";

    let userRecord = await this.prisma.user.findUnique({ where: { email: invite.email } });
    if (userRecord) {
      const ok =
        !!userRecord.passwordHash &&
        (await this.auth.verifyPassword(password, userRecord.passwordHash));
      if (!ok) throw new BadRequestException("Incorrect password for this account.");
    } else {
      if (password.length < 6) {
        throw new BadRequestException("Choose a password of at least 6 characters.");
      }
      userRecord = await this.prisma.user.create({
        data: {
          email: invite.email,
          name: dto.name?.trim() || null,
          passwordHash: await this.auth.hashPassword(password),
        },
      });
    }

    await this.prisma.membership.upsert({
      where: { orgId_userId: { orgId: invite.orgId, userId: userRecord.id } },
      create: { orgId: invite.orgId, userId: userRecord.id, role: invite.role },
      update: {},
    });
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    return this.auth.issueForUserId(userRecord.id);
  }

  /* ---------- helpers ---------- */

  private acceptUrl(token: string) {
    const base = env.PUBLIC_TENANT_URL;
    return `${base.replace(/\/$/, "")}/invite/${token}`;
  }

  private async loadPendingInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.status !== "pending") {
      throw new NotFoundException("This invite is no longer valid.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This invite has expired. Ask for a new one.");
    }
    return invite;
  }

  private normalizeRole(role: string): Role {
    const r = role?.toUpperCase() as Role;
    if (!ROLES.includes(r)) throw new BadRequestException(`Unknown role: ${role}`);
    return r;
  }

  private ownerCount(orgId: string) {
    return this.prisma.membership.count({ where: { orgId, role: "OWNER" } });
  }

  private async assertMember(user: AuthUser): Promise<{ role: Role }> {
    const m = await this.prisma.membership.findFirst({
      where: { orgId: user.orgId, userId: user.sub },
      select: { role: true },
    });
    if (!m) throw new ForbiddenException("You are not a member of this team.");
    return m;
  }

  private async assertManager(user: AuthUser): Promise<{ role: Role }> {
    const m = await this.assertMember(user);
    if (!MANAGER_ROLES.includes(m.role)) {
      throw new ForbiddenException("Only owners and admins can manage the team.");
    }
    return m;
  }
}
