import {
  BadRequestException,
  ForbiddenException,
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
  status: string;
  memberships: { orgId: string; org: { status: string; workspaces: { id: string }[] } }[];
};

/**
 * What issue() needs, oldest membership first. A user belongs to one
 * organisation (version 1), so the order only matters for data from before that
 * rule; it keeps the choice predictable.
 */
const WITH_MEMBERSHIPS = {
  memberships: {
    orderBy: { createdAt: "asc" },
    include: { org: { include: { workspaces: { orderBy: { createdAt: "asc" } } } } },
  },
} as const;

/** The name of the organisation made for a new account. */
const teamName = (name: string | null) => (name ? `${name}'s team` : "My workspace");

/** A new organisation, with its one workspace, for a nested create. */
const newOrg = (name: string | null) => ({
  name: teamName(name),
  slug: "org-" + Math.random().toString(36).slice(2, 10),
  workspaces: { create: { name: "My Workspace" } },
});

/**
 * sessionsValidFrom for "from now on": every token issued before this moment is
 * refused. Tokens carry their issue time to the millisecond (`issuedAtMs`), so
 * the one a password reset returns, signed just after, stays valid.
 */
export const sessionsStart = () => new Date();

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
    return { ...this.issue(user), ...(env.RETURN_EMAIL_LINKS_FOR_TESTS ? { emailVerifyUrl } : {}) };
  }

  /** Create a user + their own org/workspace (OWNER). passwordHash is null for OAuth users. */
  private createAccount(email: string, name: string | null, passwordHash: string | null) {
    return this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        emailVerified: passwordHash === null, // OAuth emails are pre-verified
        memberships: { create: { role: "OWNER", org: { create: newOrg(name) } } },
      },
      include: WITH_MEMBERSHIPS,
    });
  }

  async login(emailRaw: string, password: string) {
    const email = (emailRaw || "").trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: WITH_MEMBERSHIPS });
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
    return { ...user, role: auth.role, orgId: auth.orgId };
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
      subject: "Verify your email · ZoForms",
      html: this.mail.layout(
        "Confirm your email",
        "Please confirm your email address to secure your ZoForms account.",
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
    // emailSent: false when email isn't configured, so the page doesn't claim a link went out.
    return {
      ok: true,
      emailSent: this.mail.enabled,
      ...(env.RETURN_EMAIL_LINKS_FOR_TESTS ? { verifyUrl: url } : {}),
    };
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
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: WITH_MEMBERSHIPS });
    if (!user) throw new UnauthorizedException();
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

    const user = await this.prisma.user.findUnique({ where: { email }, include: WITH_MEMBERSHIPS });
    if (!user) return this.issue(await this.createAccount(email, payload?.name?.trim() || null, null));
    if (!user.emailVerified) await this.claimUnverified(user.id, email, payload?.name?.trim() || null);
    return this.issueForUserId(user.id);
  }

  /**
   * Google has proved this address, but the account with it was never verified:
   * whoever made it may not own the address. So it becomes the Google user's
   * alone: verified, no password, every token issued before now refused, and
   * only the organisation it made at sign-up kept. A membership that came from
   * an invite to this address is removed, since whoever set the password may
   * have accepted that invite. If nothing is left, a new organisation of its own.
   */
  private async claimUnverified(userId: string, email: string, name: string | null) {
    const invitedOrgIds = (
      await this.prisma.invite.findMany({ where: { email }, select: { orgId: true } })
    ).map((i) => i.orgId);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { emailVerified: true, passwordHash: null, sessionsValidFrom: sessionsStart() },
      });
      if (invitedOrgIds.length) {
        await tx.membership.deleteMany({ where: { userId, orgId: { in: invitedOrgIds } } });
      }
      if (!(await tx.membership.count({ where: { userId } }))) {
        await tx.membership.create({ data: { user: { connect: { id: userId } }, role: "OWNER", org: { create: newOrg(name) } } });
      }
    });
  }

  /* ---------- forgot / reset password ---------- */

  async forgotPassword(emailRaw: string) {
    const email = (emailRaw || "").trim().toLowerCase();
    // Always the same answer, so it never reveals whether an account exists.
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
      subject: "Reset your ZoForms password",
      html: this.mail.layout(
        "Reset your password",
        "Choose a new password with the button below. This link expires in 1 hour. If you didn't request this, you can safely ignore this email.",
        { label: "Reset password", url },
      ),
    });
    // Without email configured nothing is sent (the mailer logs that), and the
    // answer is the same: the link is in it only with the test-only setting.
    return env.RETURN_EMAIL_LINKS_FOR_TESTS ? { ok: true, resetUrl: url } : { ok: true };
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
        // The link came by email, so the address is proven; tokens from before the reset stop working.
        data: { passwordHash, emailVerified: true, sessionsValidFrom: sessionsStart() },
      }),
      this.prisma.emailToken.deleteMany({ where: { userId: record.userId, type: "reset" } }),
    ]);
    return this.issueForUserId(record.userId);
  }

  /** A token for the user's organisation. Refused for a suspended user or organisation, or no organisation. */
  private issue(user: IssueUser) {
    if (user.status !== "active") throw new ForbiddenException("This account is suspended.");
    const membership = user.memberships[0];
    if (!membership?.org.workspaces[0]) {
      throw new ForbiddenException("Your account isn't part of a team. Ask a team owner or admin to invite you.");
    }
    if (membership.org.status !== "active") throw new ForbiddenException("Your team's account is suspended.");
    const workspace = membership.org.workspaces[0];
    const payload = {
      sub: user.id,
      email: user.email,
      orgId: membership.orgId,
      workspaceId: workspace.id,
      issuedAtMs: Date.now(),
    };
    return {
      token: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
