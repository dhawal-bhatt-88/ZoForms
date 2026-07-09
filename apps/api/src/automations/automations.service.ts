import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/current-user.decorator";

type UpsertDto = {
  name?: string;
  action?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
};

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForForm(user: AuthUser, formId: string) {
    await this.assertFormOwned(user, formId);
    return this.prisma.automation.findMany({
      where: { formId },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(user: AuthUser, formId: string, dto: UpsertDto) {
    await this.assertFormOwned(user, formId);
    const action = dto.action || "webhook";
    if (action === "webhook") this.assertUrl(dto.config?.url);
    return this.prisma.automation.create({
      data: {
        formId,
        name: dto.name?.trim() || "New response webhook",
        action,
        enabled: dto.enabled ?? true,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpsertDto) {
    const existing = await this.assertAutomationOwned(user, id);
    const action = dto.action || existing.action;
    const config = dto.config ?? (existing.config as Record<string, unknown>);
    if (action === "webhook") this.assertUrl(config?.url);
    return this.prisma.automation.update({
      where: { id },
      data: {
        name: dto.name?.trim() || undefined,
        action: dto.action || undefined,
        enabled: dto.enabled,
        config:
          dto.config === undefined
            ? undefined
            : (dto.config as Prisma.InputJsonValue),
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.assertAutomationOwned(user, id);
    await this.prisma.automation.delete({ where: { id } });
    return { ok: true };
  }

  /** Deliver a payload to all enabled webhooks for a form. Fire-and-forget:
   * never throws into the submit path. */
  async dispatch(
    formId: string,
    payload: { formId: string; slug?: string; responseId: string; data: unknown },
  ) {
    let automations;
    try {
      automations = await this.prisma.automation.findMany({
        where: { formId, enabled: true, action: "webhook" },
      });
    } catch {
      return;
    }
    await Promise.all(
      automations.map((a) => this.deliverWebhook(a.id, a.config, payload)),
    );
  }

  private async deliverWebhook(
    id: string,
    config: unknown,
    payload: unknown,
  ) {
    const url = (config as { url?: string } | null)?.url;
    let status = "error";
    if (url) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Frame-Webhooks/1.0",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });
        status = `${res.status}`;
      } catch (e) {
        status = (e as Error).name === "TimeoutError" ? "timeout" : "error";
      }
    }
    try {
      await this.prisma.automation.update({
        where: { id },
        data: { lastFiredAt: new Date(), lastStatus: status },
      });
    } catch {
      /* automation may have been deleted mid-flight */
    }
    return status;
  }

  /** Send a sample payload so the user can confirm the endpoint works. */
  async test(user: AuthUser, id: string) {
    const a = await this.assertAutomationOwned(user, id);
    const status = await this.deliverWebhook(a.id, a.config, {
      test: true,
      formId: a.formId,
      responseId: "test-000",
      data: { example: "This is a test delivery from Frame." },
    });
    return { ok: status.startsWith("2"), status };
  }

  /* ---------- helpers ---------- */

  private assertUrl(url: unknown) {
    if (typeof url !== "string" || !/^https?:\/\/.+/i.test(url)) {
      throw new BadRequestException("Enter a valid webhook URL (http/https).");
    }
  }

  private async assertFormOwned(user: AuthUser, formId: string) {
    const f = await this.prisma.form.findFirst({
      where: { id: formId, workspace: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!f) throw new NotFoundException("Form not found");
  }

  private async assertAutomationOwned(user: AuthUser, id: string) {
    const a = await this.prisma.automation.findFirst({
      where: { id, form: { workspace: { orgId: user.orgId } } },
    });
    if (!a) throw new NotFoundException("Automation not found");
    return a;
  }
}
