import { ForbiddenException } from "@nestjs/common";
import type { AuthUser } from "./current-user.decorator";

/**
 * Authors write; viewers only read. An author is any member of the
 * organisation who isn't a VIEWER. Shared by forms and templates. The role is
 * the one AuthGuard read from the database for this request.
 */
export function assertCanEdit(user: AuthUser): void {
  if (user.role === "VIEWER") {
    throw new ForbiddenException("Viewers have read-only access.");
  }
}
