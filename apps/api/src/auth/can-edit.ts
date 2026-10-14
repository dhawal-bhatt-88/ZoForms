import { ForbiddenException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "./current-user.decorator";

/**
 * Authors write; viewers only read. An author is any member of the
 * organisation who isn't a VIEWER. Shared by forms and templates.
 */
export async function assertCanEdit(prisma: PrismaClient, user: AuthUser): Promise<void> {
  const m = await prisma.membership.findFirst({
    where: { orgId: user.orgId, userId: user.sub },
    select: { role: true },
  });
  if (!m || m.role === "VIEWER") {
    throw new ForbiddenException("Viewers have read-only access.");
  }
}
