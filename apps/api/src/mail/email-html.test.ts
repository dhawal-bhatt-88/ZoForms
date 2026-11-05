import { describe, expect, it } from "vitest";
import { cleanSubject, escapeHtml, renderLayout } from "./email-html";
import { MailService } from "./mail.service";
import { TeamService } from "../team/team.service";

/** The sign-up name from the release audit (lead 5). */
const HOSTILE = `<img src=x onerror=alert(1)><a href="https://evil.example">Click here to keep your account</a>`;

/** Markup that may appear in an email: the layout's own tags, nothing else. */
const tags = (html: string) => [...new Set([...html.matchAll(/<\/?([a-z0-9]+)/gi)].map((m) => m[1].toLowerCase()))].sort();
const LAYOUT_TAGS = ["a", "div", "h1", "strong"];

describe("escapeHtml", () => {
  it("escapes every character that can start or end markup or an attribute", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
});

describe("renderLayout", () => {
  it("escapes the heading, the body, bold runs and the button", () => {
    const html = renderLayout(HOSTILE, ["Hi ", { strong: HOSTILE }, HOSTILE], { label: HOSTILE, url: "https://forms.example/x" });
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="https://evil.example"');
    expect(tags(html)).toEqual(LAYOUT_TAGS);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("keeps a link's own characters safe in the href, and leaves out a link that isn't http(s)", () => {
    const html = renderLayout("H", "B", { label: "Go", url: 'https://forms.example/a?b="c"' });
    expect(html).toContain('href="https://forms.example/a?b=%22c%22"');
    expect(renderLayout("H", "B", { label: "Go", url: "javascript:alert(1)" })).not.toContain("<a ");
  });
});

describe("cleanSubject", () => {
  it("makes a subject one line", () => {
    expect(cleanSubject("Hello\r\nBcc: someone@example.test")).toBe("Hello Bcc: someone@example.test");
  });
});

describe("the invite email, with the audit's hostile organisation name", () => {
  it("has the name as text, in the heading and the subject, and no markup of its own", async () => {
    const sent: { subject: string; html: string }[] = [];
    const mail = Object.assign(Object.create(MailService.prototype), {
      enabled: true,
      send: async (m: { subject: string; html: string }) => (sent.push(m), true),
    });
    const prisma = {
      user: { findUnique: async () => ({ emailVerified: true }) },
      membership: { findFirst: async () => null },
      invite: { upsert: async (a: { create: object }) => ({ id: "i1", ...a.create }) },
      organization: { findUnique: async () => ({ name: `${HOSTILE}'s team` }) },
    };
    const team = new TeamService(prisma as never, null as never, mail);
    await team.createInvite({ sub: "u1", email: "o@example.test", orgId: "o1", workspaceId: "w1", role: "OWNER" }, { email: "x@example.test", role: "EDITOR" });
    const [email] = sent;
    expect(tags(email.html)).toEqual(LAYOUT_TAGS);
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("Join &lt;img src=x onerror=alert(1)&gt;");
    expect(email.html).toContain("You&#39;ve been invited as <strong>Editor</strong>. Accept to get started.");
    expect(email.subject).toBe(`You're invited to ${HOSTILE}'s team on ZoForms`);
  });
});
