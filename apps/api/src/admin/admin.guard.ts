import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { tokenRevoked } from "../auth/auth.guard";

/**
 * Allows only authenticated platform admins (User.isAdmin), signed in as
 * themselves: an impersonation token is refused, and so is a token older than
 * the admin's sessionsValidFrom.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    if (!header || !header.startsWith("Bearer ")) throw new UnauthorizedException();
    let payload: { sub: string; iat?: number; issuedAtMs?: number; impersonatedBy?: string };
    try {
      payload = this.jwt.verify(header.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, isAdmin: true, status: true, sessionsValidFrom: true },
    });
    if (user && tokenRevoked(payload, user.sessionsValidFrom)) throw new UnauthorizedException();
    if (!user || !user.isAdmin || user.status !== "active" || payload.impersonatedBy) {
      throw new ForbiddenException("Admin access required");
    }
    req.admin = { id: user.id, email: user.email, isAdmin: user.isAdmin, status: user.status };
    return true;
  }
}

export type AdminActor = { id: string; email: string };
