import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { promises as dns } from "dns";
import { PrismaService } from "../prisma/prisma.service";
import { assertFeature } from "../billing/billing.service";
import { env } from "../config/env";
import type { AuthUser } from "../auth/current-user.decorator";

const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;

@Injectable()
export class DomainsService {
  private readonly logger = new Logger("Domains");
  private readonly cfEnabled = !!(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ZONE_ID);

  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const domains = await this.prisma.domain.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
    });
    return { domains, cnameTarget: env.DOMAIN_CNAME_TARGET, managed: this.cfEnabled };
  }

  async add(user: AuthUser, hostnameRaw: string) {
    await this.assertManager(user);
    await assertFeature(this.prisma, user.orgId, "customDomains");
    const hostname = (hostnameRaw || "").trim().toLowerCase().replace(/\.$/, "");
    if (!HOSTNAME_RE.test(hostname)) {
      throw new BadRequestException("Enter a valid domain, e.g. forms.acme.com");
    }
    const existing = await this.prisma.domain.findUnique({ where: { hostname } });
    if (existing) throw new BadRequestException("That domain is already registered.");

    let cfHostnameId: string | null = null;
    let status = "pending";
    let lastError: string | null = null;
    if (this.cfEnabled) {
      try {
        cfHostnameId = await this.cfCreate(hostname);
      } catch (e) {
        status = "error";
        lastError = (e as Error).message;
      }
    }

    const domain = await this.prisma.domain.create({
      data: { orgId: user.orgId, hostname, status, cfHostnameId, lastError },
    });
    return { domain, cnameTarget: env.DOMAIN_CNAME_TARGET, managed: this.cfEnabled };
  }

  /** Re-check a domain: Cloudflare status when managed, otherwise a DNS CNAME check. */
  async verify(user: AuthUser, id: string) {
    const domain = await this.assertOwned(user, id);
    let status = domain.status;
    let lastError: string | null = null;

    if (this.cfEnabled && domain.cfHostnameId) {
      try {
        status = await this.cfStatus(domain.cfHostnameId);
      } catch (e) {
        status = "error";
        lastError = (e as Error).message;
      }
    } else {
      status = (await this.cnamePointsHere(domain.hostname)) ? "active" : "pending";
      if (status === "pending") {
        lastError = `Add a CNAME record: ${domain.hostname} → ${env.DOMAIN_CNAME_TARGET}`;
      }
    }

    return this.prisma.domain.update({
      where: { id },
      data: {
        status,
        lastError,
        verifiedAt: status === "active" ? new Date() : domain.verifiedAt,
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.assertManager(user);
    const domain = await this.assertOwned(user, id);
    if (this.cfEnabled && domain.cfHostnameId) {
      await this.cfDelete(domain.cfHostnameId).catch((e) =>
        this.logger.warn(`Cloudflare delete failed: ${(e as Error).message}`),
      );
    }
    await this.prisma.domain.delete({ where: { id } });
    return { ok: true };
  }

  /* ---------- Cloudflare SSL-for-SaaS ---------- */

  private cfHeaders() {
    return {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    };
  }

  private async cfCreate(hostname: string): Promise<string> {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames`,
      {
        method: "POST",
        headers: this.cfHeaders(),
        body: JSON.stringify({ hostname, ssl: { method: "http", type: "dv" } }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body = (await res.json()) as {
      success: boolean;
      result?: { id: string };
      errors?: { message: string }[];
    };
    if (!body.success || !body.result) {
      throw new Error(body.errors?.[0]?.message || "Cloudflare rejected the hostname.");
    }
    return body.result.id;
  }

  private async cfStatus(cfHostnameId: string): Promise<string> {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames/${cfHostnameId}`,
      { headers: this.cfHeaders(), signal: AbortSignal.timeout(10_000) },
    );
    const body = (await res.json()) as {
      success: boolean;
      result?: { status: string; ssl?: { status: string } };
    };
    if (!body.success || !body.result) throw new Error("Couldn't read Cloudflare status.");
    // "active" hostname + "active" cert = fully live.
    return body.result.status === "active" && body.result.ssl?.status === "active"
      ? "active"
      : "pending";
  }

  private async cfDelete(cfHostnameId: string) {
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames/${cfHostnameId}`,
      { method: "DELETE", headers: this.cfHeaders(), signal: AbortSignal.timeout(10_000) },
    );
  }

  /* ---------- DNS fallback ---------- */

  private async cnamePointsHere(hostname: string): Promise<boolean> {
    const target = env.DOMAIN_CNAME_TARGET.toLowerCase().replace(/\.$/, "");
    try {
      const records = await dns.resolveCname(hostname);
      return records.some((r) => r.toLowerCase().replace(/\.$/, "") === target);
    } catch {
      return false;
    }
  }

  private async assertOwned(user: AuthUser, id: string) {
    const domain = await this.prisma.domain.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!domain) throw new NotFoundException("Domain not found");
    return domain;
  }

  private async assertManager(user: AuthUser) {
    const m = await this.prisma.membership.findFirst({
      where: { orgId: user.orgId, userId: user.sub },
      select: { role: true },
    });
    if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) {
      throw new ForbiddenException("Only owners and admins can manage domains.");
    }
  }
}
