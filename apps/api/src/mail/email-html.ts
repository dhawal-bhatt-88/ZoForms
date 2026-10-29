/**
 * The HTML of every email, built from text. Each value is escaped here, so a
 * caller never writes HTML: an organisation's name, a person's name or a link
 * can't add markup to the email, however it was typed.
 */

/** Plain text, or runs of it, some in bold. */
export type EmailText = string | readonly (string | { strong: string })[];

/** Text made safe for an HTML element or a double-quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderText(text: EmailText): string {
  const runs = typeof text === "string" ? [text] : text;
  return runs.map((run) => (typeof run === "string" ? escapeHtml(run) : `<strong>${escapeHtml(run.strong)}</strong>`)).join("");
}

/** Only http(s) links become a button; anything else is left out. */
function safeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** A subject is one line of text: line breaks become spaces. */
export function cleanSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, " ").trim();
}

/** Minimal branded wrapper so every Zowork Forms email looks consistent. */
export function renderLayout(heading: string, body: EmailText, cta?: { label: string; url: string }): string {
  const href = cta ? safeUrl(cta.url) : null;
  const button =
    cta && href
      ? `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:20px;padding:11px 22px;background:#18181B;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a>`
      : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:8px">
      <div style="font-size:18px;font-weight:800;letter-spacing:-.02em;color:#18181B">Zowork Forms</div>
      <div style="margin-top:20px;padding:24px;border:1px solid #ECEDF0;border-radius:16px;background:#fff">
        <h1 style="margin:0 0 8px;font-size:19px;color:#1B1D22">${escapeHtml(heading)}</h1>
        <div style="font-size:14px;line-height:1.6;color:#3B3F47">${renderText(body)}</div>
        ${button}
      </div>
    </div>`;
}
