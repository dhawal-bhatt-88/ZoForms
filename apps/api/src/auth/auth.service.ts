import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { env } from "../config/env";
import type { AuthUser } from "./current-user.decorator";

type IssueUser = {
  id: string;
  email: string;
  name: string | null;
  memberships: { orgId: string; org: { workspaces: { id: string }[] } }[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async signup(emailRaw: string, password: string, name?: string) {
    const email = (emailRaw || "").trim().toLowerCase();
    if (!email || !password || password.length < 6) {
      throw new BadRequestException(
        "Enter an email and a password of at least 6 characters.",
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException("An account with that email already exists.");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const teamName = name?.trim() ? `${name.trim()}'s team` : "My workspace";
    const user = await this.prisma.user.create({
      data: {
        email,
        name: name?.trim() || null,
        passwordHash,
        memberships: {
          create: {
            role: "OWNER",
            org: {
              create: {
                name: teamName,
                slug: "org-" + Math.random().toString(36).slice(2, 10),
                workspaces: { create: { name: "My Workspace" } },
              },
            },
          },
        },
      },
      include: {
        memberships: { include: { org: { include: { workspaces: true } } } },
      },
    });
    const emailVerifyUrl = await this.createEmailToken(user.id);
    return { ...this.issue(user), emailVerifyUrl };
  }

  async login(emailRaw: string, password: string) {
    const email = (emailRaw || "").trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: { include: { org: { include: { workspaces: true } } } },
      },
    });
    if (
      !user ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    return this.issue(user);
  }

  async me(auth: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, email: true, name: true, emailVerified: true },
    });
    if (!user) throw new UnauthorizedException();
    const membership = await this.prisma.membership.findFirst({
      where: { orgId: auth.orgId, userId: auth.sub },
      select: { role: true },
    });
    return { ...user, role: membership?.role ?? "VIEWER", orgId: auth.orgId };
  }

  /* ---------- email verification ---------- */

  private async createEmailToken(userId: string): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const record = await this.prisma.emailToken.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 3 * 86_400_000) },
      include: { user: { select: { email: true } } },
    });
    const url = `${env.PUBLIC_TENANT_URL.replace(/\/$/, "")}/verify-email/${token}`;
    void this.mail.send({
      to: record.user.email,
      subject: "Verify your email · Frame",
      html: this.mail.layout(
        "Confirm your email",
        "Please confirm your email address to secure your Frame account.",
        { label: "Verify email", url },
      ),
    });
    return url;
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailToken.findUnique({ where: { token } });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This verification link is invalid or expired.");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      this.prisma.emailToken.deleteMany({ where: { userId: record.userId } }),
    ]);
    return { ok: true };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerified) return { ok: true, alreadyVerified: true };
    await this.prisma.emailToken.deleteMany({ where: { userId } });
    const url = await this.createEmailToken(userId);
    return { ok: true, verifyUrl: url };
  }

  /* ---------- password + token helpers (shared with invites) ---------- */

  hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  /** Issue a fresh token for a user id (used after accepting an invite). */
  async issueForUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { org: { include: { workspaces: true } } } } },
    });
    if (!user || !user.memberships[0]) throw new UnauthorizedException();
    return this.issue(user);
  }

  private issue(user: IssueUser) {
    const membership = user.memberships[0];
    const workspace = membership.org.workspaces[0];
    const payload = {
      sub: user.id,
      email: user.email,
      orgId: membership.orgId,
      workspaceId: workspace.id,
    };
    return {
      token: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
