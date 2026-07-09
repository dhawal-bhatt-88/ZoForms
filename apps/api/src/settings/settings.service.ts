import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/current-user.decorator";

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
      envKeyPresent: !!process.env.ANTHROPIC_API_KEY,
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

  /** Resolve the effective Anthropic config (org key wins, else env). */
  async resolveAnthropic(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { anthropicApiKey: true, aiModel: true },
    });
    return {
      apiKey: org?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined,
      model: org?.aiModel || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
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
