import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

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
    return this.issue(user);
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

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
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
