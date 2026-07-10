import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Delete an org's responses older than its retention window. Returns the count. */
export async function purgeOrg(
  prisma: PrismaService,
  orgId: string,
  retentionDays: number,
): Promise<number> {
  if (!retentionDays || retentionDays <= 0) return 0;
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const res = await prisma.response.deleteMany({
    where: { createdAt: { lt: cutoff }, form: { workspace: { orgId } } },
  });
  return res.count;
}

/**
 * Enforces per-org response retention on a daily cadence (plus once shortly
 * after boot). A lightweight in-process scheduler; a BullMQ worker replaces it
 * at scale.
 */
@Injectable()
export class RetentionService implements OnModuleInit {
  private readonly logger = new Logger("Retention");

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    setTimeout(() => void this.purgeAll(), 15_000).unref();
    setInterval(() => void this.purgeAll(), 24 * 60 * 60 * 1000).unref();
  }

  async purgeAll(): Promise<number> {
    const orgs = await this.prisma.organization.findMany({
      where: { retentionDays: { gt: 0 } },
      select: { id: true, retentionDays: true },
    });
    let total = 0;
    for (const org of orgs) {
      total += await purgeOrg(this.prisma, org.id, org.retentionDays);
    }
    if (total) this.logger.log(`Purged ${total} responses past retention.`);
    return total;
  }
}
