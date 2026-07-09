import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export type AuthUser = {
  sub: string;
  email: string;
  orgId: string;
  workspaceId: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
