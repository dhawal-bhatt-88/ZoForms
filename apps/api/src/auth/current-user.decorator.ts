import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Role } from "@prisma/client";

/** The signed-in user: the token's claims, and the role AuthGuard read from the database for this request. */
export type AuthUser = {
  sub: string;
  email: string;
  orgId: string;
  workspaceId: string;
  role: Role;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
