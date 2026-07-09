import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";

/** Allows only authenticated platform admins (User.isAdmin). */
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
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(header.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, isAdmin: true, status: true },
    });
    if (!user || !user.isAdmin || user.status !== "active") {
      throw new ForbiddenException("Admin access required");
    }
    req.admin = user;
    return true;
  }
}

export type AdminActor = { id: string; email: string };
