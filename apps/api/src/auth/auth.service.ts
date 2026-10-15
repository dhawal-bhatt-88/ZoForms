import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { parsePreferencesPatch } from "@formbuilder/form-schema";
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
    const user = await this.createAccount(email, name?.trim() || null, passwordHash);
    const emailVerifyUrl = await this.createEmailToken(user.id);
    return { ...this.issue(user), emailVerifyUrl };
  }

  /** Create a user + their own org/workspace (OWNER). passwordHash is null for OAuth users. */
  private createAccount(email: string, name: string | null, passwordHash: string | null) {
    const teamName = name ? `${name}'s team` : "My workspace";
    return this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        emailVerified: passwordHash === null, // OAuth emails are pre-verified
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
      // settingsPaneWidth comes with the user so the editor lays out its pane at the right width at once.
      select: { id: true, email: true, name: true, emailVerified: true, settingsPaneWidth: true },
    });
    if (!user) throw new UnauthorizedException();
    const membership = await this.prisma.membership.findFirst({
      where: { orgId: auth.orgId, userId: auth.sub },
      select: { role: true },
    });
    return { ...user, role: membership?.role ?? "VIEWER", orgId: auth.orgId };
  }

  /** Sets or clears (null) the signed-in author's preferences: for now, the settings pane width. */
  async updatePreferences(auth: AuthUser, body: unknown) {
    const parsed = parsePreferencesPatch(body);
    if (!parsed.ok) throw new BadRequestException(parsed.message);
    return this.prisma.user.update({
      where: { id: auth.sub },
      data: parsed.value,
      select: { settingsPaneWidth: true },
    });
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
    if (!record || record.type !== "verify" || record.expiresAt.getTime() < Date.now()) {
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

  /* ---------- Google sign-in ---------- */

  async loginWithGoogle(credential: string) {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new BadRequestException("Google sign-in isn't configured.");
    }
    if (!credential) throw new BadRequestException("Missing Google credential.");

    let payload: { email?: string; email_verified?: boolean; name?: string } | undefined;
    try {
      const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload() ?? undefined;
    } catch {
      throw new UnauthorizedException("Couldn't verify your Google sign-in.");
    }

    const email = payload?.email?.trim().toLowerCase();
    if (!email || payload?.email_verified === false) {
      throw new UnauthorizedException("Your Google account has no verified email.");
    }

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { org: { include: { workspaces: true } } } } },
    });
    if (!user) {
      user = await this.createAccount(email, payload?.name?.trim() || null, null);
    } else if (!user.emailVerified) {
      await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }
    return this.issue(user);
  }

  /* ---------- forgot / reset password ---------- */

  async forgotPassword(emailRaw: string) {
    const email = (emailRaw || "").trim().toLowerCase();
    // Always return ok so we never reveal whether an account exists.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: true };
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return { ok: true };

    await this.prisma.emailToken.deleteMany({ where: { userId: user.id, type: "reset" } });
    const token = randomBytes(24).toString("hex");
    await this.prisma.emailToken.create({
      data: { userId: user.id, token, type: "reset", expiresAt: new Date(Date.now() + 3_600_000) },
    });
    const url = `${env.PUBLIC_TENANT_URL.replace(/\/$/, "")}/reset-password/${token}`;
    void this.mail.send({
      to: email,
      subject: "Reset your Frame password",
      html: this.mail.layout(
        "Reset your password",
        "Choose a new password with the button below. This link expires in 1 hour. If you didn't request this, you can safely ignore this email.",
        { label: "Reset password", url },
      ),
    });
    // Surface the link only in dev (no Resend configured) so the flow is testable.
    return this.mail.enabled ? { ok: true } : { ok: true, resetUrl: url };
  }

  async resetPassword(token: string, password: string) {
    if (!password || password.length < 6) {
      throw new BadRequestException("Choose a password of at least 6 characters.");
    }
    const record = await this.prisma.emailToken.findUnique({ where: { token } });
    if (!record || record.type !== "reset" || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This reset link is invalid or expired.");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, emailVerified: true },
      }),
      this.prisma.emailToken.deleteMany({ where: { userId: record.userId, type: "reset" } }),
    ]);
    return this.issueForUserId(record.userId);
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
