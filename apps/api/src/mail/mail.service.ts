import { Injectable, Logger } from "@nestjs/common";
import { env } from "../config/env";
import { cleanSubject, renderLayout, type EmailText } from "./email-html";

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
    const subject = cleanSubject(msg.subject);
    if (!this.enabled) {
      // Never the message itself: it can hold a sign-in link.
      this.logger.log(`Email isn't configured (RESEND_API_KEY unset): "${subject}" to ${to.join(", ")} not sent.`);
      return false;
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: env.MAIL_FROM, to, subject, html: msg.html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Resend responded ${res.status} for "${subject}"`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`Email send failed: ${(e as Error).message}`);
      return false;
    }
  }

  /** Every email's HTML, from text: each value is escaped (email-html.ts), so no caller writes HTML. */
  layout(heading: string, body: EmailText, cta?: { label: string; url: string }): string {
    return renderLayout(heading, body, cta);
  }
}
