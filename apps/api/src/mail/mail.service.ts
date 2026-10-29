import { Injectable, Logger } from "@nestjs/common";
import { env } from "../config/env";

type MailMessage = {
  to: string | string[];
  subject: string;
  html: string;
};

/**
 * Transactional email via Resend.
 *
 * Graceful by design: without `RESEND_API_KEY` the message is logged and
 * skipped (returns false) so every email-sending feature works in development
 * and lights up automatically once a key is configured.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");
  readonly enabled = !!env.RESEND_API_KEY;

  async send(msg: MailMessage): Promise<boolean> {
    const to = Array.isArray(msg.to) ? msg.to : [msg.to];
    if (!this.enabled) {
      // Never the message itself: it can hold a sign-in link.
      this.logger.log(`Email isn't configured (RESEND_API_KEY unset): "${msg.subject}" to ${to.join(", ")} not sent.`);
      return false;
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: env.MAIL_FROM, to, subject: msg.subject, html: msg.html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Resend responded ${res.status} for "${msg.subject}"`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`Email send failed: ${(e as Error).message}`);
      return false;
    }
  }

  /** Minimal branded wrapper so every Zowork Forms email looks consistent. */
  layout(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
    const button = cta
      ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;padding:11px 22px;background:#18181B;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${cta.label}</a>`
      : "";
    return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:8px">
      <div style="font-size:18px;font-weight:800;letter-spacing:-.02em;color:#18181B">Zowork Forms</div>
      <div style="margin-top:20px;padding:24px;border:1px solid #ECEDF0;border-radius:16px;background:#fff">
        <h1 style="margin:0 0 8px;font-size:19px;color:#1B1D22">${heading}</h1>
        <div style="font-size:14px;line-height:1.6;color:#3B3F47">${bodyHtml}</div>
        ${button}
      </div>
    </div>`;
  }
}
