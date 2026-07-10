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

/** A single answer, resolved to its human label, for readable deliveries. */
export type DispatchField = { label: string; value: unknown };

export type DispatchPayload = {
  formId: string;
  formTitle: string;
  slug?: string;
  responseId: string;
  submittedAt: string;
  data: Record<string, unknown>;
  fields: DispatchField[];
};

/** Every destination we know how to deliver to. All are URL-based (POST). */
const ACTIONS = ["webhook", "slack", "google_sheets", "zapier", "make"] as const;
type Action = (typeof ACTIONS)[number];

const DEFAULT_NAME: Record<Action, string> = {
  webhook: "New response webhook",
  slack: "Slack notification",
  google_sheets: "Google Sheets row",
  zapier: "Zapier",
  make: "Make (Integromat)",
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
    const action = this.normalizeAction(dto.action);
    this.assertUrl(dto.config?.url);
    return this.prisma.automation.create({
      data: {
        formId,
        name: dto.name?.trim() || DEFAULT_NAME[action],
        action,
        enabled: dto.enabled ?? true,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpsertDto) {
    const existing = await this.assertAutomationOwned(user, id);
    const action = this.normalizeAction(dto.action || existing.action);
    const config = dto.config ?? (existing.config as Record<string, unknown>);
    this.assertUrl(config?.url);
    return this.prisma.automation.update({
      where: { id },
      data: {
        name: dto.name?.trim() || undefined,
        action: dto.action ? action : undefined,
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

  /** Deliver a payload to every enabled automation for a form. Fire-and-forget:
   * never throws into the submit path. */
  async dispatch(formId: string, payload: DispatchPayload) {
    let automations;
    try {
      automations = await this.prisma.automation.findMany({
        where: { formId, enabled: true },
      });
    } catch {
      return;
    }
    await Promise.all(
      automations.map((a) => this.deliver(a.id, a.action, a.config, payload)),
    );
  }

  /** Send a sample payload so the user can confirm the destination works. */
  async test(user: AuthUser, id: string) {
    const a = await this.assertAutomationOwned(user, id);
    const status = await this.deliver(
      a.id,
      a.action,
      a.config,
      this.samplePayload(a.formId),
    );
    return { ok: status.startsWith("2"), status };
  }

  /* ---------- delivery ---------- */

  private async deliver(
    id: string,
    action: string,
    config: unknown,
    payload: DispatchPayload,
  ): Promise<string> {
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
          body: JSON.stringify(this.bodyFor(action, payload)),
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

  /** Shape the request body per destination. */
  private bodyFor(action: string, p: DispatchPayload): unknown {
    switch (action) {
      case "slack":
        return { text: this.slackText(p) };
      case "google_sheets":
        // Flat row keyed by human label — an Apps Script web app appends it.
        return {
          formId: p.formId,
          formTitle: p.formTitle,
          responseId: p.responseId,
          submittedAt: p.submittedAt,
          row: this.flatRow(p),
        };
      // webhook / zapier / make all accept the raw response envelope.
      default:
        return p;
    }
  }

  private slackText(p: DispatchPayload): string {
    const lines = p.fields
      .slice(0, 20)
      .map((f) => `• *${f.label}:* ${this.stringify(f.value)}`)
      .join("\n");
    const more = p.fields.length > 20 ? `\n…and ${p.fields.length - 20} more` : "";
    return `:memo: *New response* to *${p.formTitle}*\n${lines}${more}`;
  }

  private flatRow(p: DispatchPayload): Record<string, string> {
    const row: Record<string, string> = { Submitted: p.submittedAt };
    for (const f of p.fields) row[f.label] = this.stringify(f.value);
    return row;
  }

  private stringify(v: unknown): string {
    if (v == null) return "";
    if (Array.isArray(v)) return v.map((x) => this.stringify(x)).join(", ");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  private samplePayload(formId: string): DispatchPayload {
    return {
      formId,
      formTitle: "Test form",
      responseId: "test-000",
      submittedAt: new Date().toISOString(),
      data: { example: "This is a test delivery from Frame." },
      fields: [{ label: "Example question", value: "Test answer" }],
    };
  }

  /* ---------- helpers ---------- */

  private normalizeAction(action: string | undefined): Action {
    const a = (action || "webhook") as Action;
    if (!ACTIONS.includes(a)) {
      throw new BadRequestException(`Unsupported integration: ${action}`);
    }
    return a;
  }

  private assertUrl(url: unknown) {
    if (typeof url !== "string" || !/^https?:\/\/.+/i.test(url)) {
      throw new BadRequestException("Enter a valid URL (http/https).");
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
