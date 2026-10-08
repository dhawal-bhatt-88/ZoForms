import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaService } from "../prisma/prisma.service";
import { purgeOrg } from "./retention.service";
import type { AuthUser } from "../auth/current-user.decorator";
import { env } from "../config/env";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Safe, client-facing view — never returns the raw key. */
  async get(user: AuthUser) {
    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { anthropicApiKey: true, aiModel: true },
    });
    const key = org?.anthropicApiKey || null;
    return {
      hasAnthropicKey: !!key,
      keyHint: key ? `${key.slice(0, 6)}…${key.slice(-4)}` : null,
      aiModel: org?.aiModel || DEFAULT_MODEL,
      envKeyPresent: !!env.ANTHROPIC_API_KEY,
    };
  }

  async update(
    user: AuthUser,
    dto: { anthropicApiKey?: string | null; aiModel?: string | null },
  ) {
    const data: { anthropicApiKey?: string | null; aiModel?: string | null } = {};
    if (dto.anthropicApiKey !== undefined) {
      const v = (dto.anthropicApiKey || "").trim();
      data.anthropicApiKey = v === "" ? null : v;
    }
    if (dto.aiModel !== undefined) {
      const v = (dto.aiModel || "").trim();
      data.aiModel = v === "" ? null : v;
    }
    await this.prisma.organization.update({ where: { id: user.orgId }, data });
    return this.get(user);
  }

  /* ---------- organization data controls ---------- */

  async getOrg(user: AuthUser) {
    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { dataRegion: true, retentionDays: true, brandingHidden: true },
    });
    return {
      dataRegion: org?.dataRegion ?? "us",
      retentionDays: org?.retentionDays ?? 0,
      brandingHidden: org?.brandingHidden ?? false,
    };
  }

  async updateOrg(
    user: AuthUser,
    dto: { dataRegion?: string; retentionDays?: number; brandingHidden?: boolean },
  ) {
    await this.assertManager(user);
    const data: {
      dataRegion?: string;
      retentionDays?: number;
      brandingHidden?: boolean;
    } = {};

    if (dto.dataRegion !== undefined) {
      if (!["us", "eu"].includes(dto.dataRegion)) {
        throw new BadRequestException("Region must be 'us' or 'eu'.");
      }
      data.dataRegion = dto.dataRegion;
    }
    if (dto.retentionDays !== undefined) {
      const n = Math.floor(Number(dto.retentionDays));
      if (Number.isNaN(n) || n < 0 || n > 3650) {
        throw new BadRequestException("Retention must be between 0 and 3650 days.");
      }
      data.retentionDays = n;
    }
    if (dto.brandingHidden !== undefined) data.brandingHidden = dto.brandingHidden;

    await this.prisma.organization.update({ where: { id: user.orgId }, data });
    return this.getOrg(user);
  }

  /** Apply the org's retention policy immediately (manager-only). */
  async purgeNow(user: AuthUser) {
    await this.assertManager(user);
    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { retentionDays: true },
    });
    const purged = await purgeOrg(this.prisma, user.orgId, org?.retentionDays ?? 0);
    return { ok: true, purged };
  }

  private async assertManager(user: AuthUser) {
    const m = await this.prisma.membership.findFirst({
      where: { orgId: user.orgId, userId: user.sub },
      select: { role: true },
    });
    if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) {
      throw new ForbiddenException("Only owners and admins can change these settings.");
    }
  }

  /** Resolve the effective Anthropic config (org key wins, else env). */
  async resolveAnthropic(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { anthropicApiKey: true, aiModel: true },
    });
    return {
      apiKey: org?.anthropicApiKey || env.ANTHROPIC_API_KEY || undefined,
      model: org?.aiModel || env.ANTHROPIC_MODEL,
    };
  }

  /** Verify the configured key by making a tiny real call to Claude. */
  async testAnthropic(user: AuthUser) {
    const { apiKey, model } = await this.resolveAnthropic(user.orgId);
    if (!apiKey) {
      return { ok: false, reason: "No API key configured." };
    }
    try {
      const client = new Anthropic({ apiKey });
      const res = await client.messages.create({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
      });
      const text = res.content.find((c) => c.type === "text");
      return {
        ok: true,
        model,
        sample: (text as { text?: string } | undefined)?.text?.trim() || "ok",
      };
    } catch (e) {
      return { ok: false, reason: (e as Error).message || "Request failed" };
    }
  }
}
