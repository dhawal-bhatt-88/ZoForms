import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "./current-user.decorator";

type TokenClaims = Omit<AuthUser, "role"> & { iat?: number; issuedAtMs?: number };

/**
 * Whether a token was issued before the user's sessionsValidFrom. Our tokens
 * carry `issuedAtMs`, to the millisecond; one without it (issued before that
 * claim existed) goes by `iat`, in whole seconds, which is never later than
 * when it was really issued.
 */
export function tokenRevoked(
  claims: { iat?: number; issuedAtMs?: number },
  sessionsValidFrom: Date | null,
): boolean {
  if (!sessionsValidFrom) return false;
  const issued = typeof claims.issuedAtMs === "number" ? claims.issuedAtMs : claims.iat !== undefined ? claims.iat * 1000 : undefined;
  return issued === undefined || issued < sessionsValidFrom.getTime();
}

/**
 * A valid token isn't enough: on every request the membership in the token's
 * organisation must still exist, the user and the organisation must be active,
 * and the token must not predate the user's sessionsValidFrom. Otherwise 401.
 * The current role goes on the request, so a role change applies at once.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException();
    }
    let claims: TokenClaims;
    try {
      claims = this.jwt.verify(header.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    if (typeof claims.sub !== "string" || typeof claims.orgId !== "string") throw new UnauthorizedException();
    // One round trip: the membership, its user and its organisation.
    const rows = await this.prisma.$queryRaw<
      { role: Role; userStatus: string; sessionsValidFrom: Date | null; orgStatus: string }[]
    >`
      SELECT m.role, u.status AS "userStatus", u."sessionsValidFrom", o.status AS "orgStatus"
      FROM "Membership" m
      JOIN "User" u ON u.id = m."userId"
      JOIN "Organization" o ON o.id = m."orgId"
      WHERE m."userId" = ${claims.sub} AND m."orgId" = ${claims.orgId}
    `;
    const row = rows[0];
    if (
      !row ||
      row.userStatus !== "active" ||
      row.orgStatus !== "active" ||
      tokenRevoked(claims, row.sessionsValidFrom)
    ) {
      throw new UnauthorizedException();
    }
    const user: AuthUser = {
      sub: claims.sub,
      email: claims.email,
      orgId: claims.orgId,
      workspaceId: claims.workspaceId,
      role: row.role,
      ...(claims.impersonatedBy ? { impersonatedBy: claims.impersonatedBy } : {}),
    };
    req.user = user;
    return true;
  }
}
