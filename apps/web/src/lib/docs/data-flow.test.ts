import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPage } from "./content";

/*
 * The facts "Where respondents' data goes" states about the builder and the
 * package (docs brief, CP3: facts only, each traceable to code), checked
 * against the code they come from. When one fails, the page needs re-reading
 * before the test is changed.
 */

const ROOT = path.join(process.cwd(), "..", "..");
const DIST = path.join(process.cwd(), "node_modules", "@zoworkhq", "zoforms", "dist");
const page = getPage("compliance/data-flow")!;
const says = (text: string) => expect(page.body.replace(/\s+/g, " ")).toContain(text);

describe("what the page says about the builder", () => {
  it("its database has the tables the page lists, and none for answers", () => {
    says("It has no table for answers");
    const schema = fs.readFileSync(path.join(ROOT, "apps", "api", "prisma", "schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
    // Accounts, organizations, members and invites; forms and their versions; templates; the admin log.
    expect(models.sort()).toEqual(["AuditLog", "EmailToken", "Form", "FormVersion", "Invite", "Membership", "Organization", "Template", "User", "Workspace"]);
  });

  it("its API has no route that receives answers", () => {
    says("the builder's API has no route that receives them");
    const routes: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".controller.ts")) {
          const code = fs.readFileSync(full, "utf8");
          const base = /@Controller\("([^"]*)"\)/.exec(code)?.[1] ?? "";
          for (const [, verb, route] of code.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*(?:"([^"]*)")?\s*\)/g)) routes.push(`${verb} /${base}/${route ?? ""}`);
        }
      }
    };
    walk(path.join(ROOT, "apps", "api", "src"));
    expect(routes.length).toBeGreaterThan(30);
    expect(routes.filter((r) => /submi|answer|draft|respon|payload/i.test(r))).toEqual([]);
  });
});

describe("what the page says about the package", () => {
  const read = (file: string) => fs.readFileSync(path.join(DIST, file), "utf8");
  const browser = read("react/index.js");
  const shared = read(fs.readdirSync(DIST).find((f) => /^chunk-.*\.js$/.test(f))!);
  const server = read("core/index.js") + read("core/index.cjs");

  it("makes one request, the POST to endpoint, and none from /core", () => {
    says("This is the only request the package makes with answers in it.");
    says("`prepareSubmission` runs on your server and makes no requests of its own.");
    const requests = /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/g;
    expect(browser.match(requests)).toEqual(["fetch("]);
    expect(browser).toMatch(/await fetch\(endpoint, \{/);
    expect(shared.match(requests)).toBeNull();
    expect(server.match(requests)).toBeNull();
  });

  it("sets no cookies and writes nothing to localStorage", () => {
    says("It sets no cookies and writes nothing to `localStorage`.");
    for (const code of [browser, shared, server]) expect(code).not.toMatch(/localStorage|document\.cookie/);
  });

  it("loads YouTube from youtube-nocookie and Vimeo with dnt=1, and images with no referrer", () => {
    says("YouTube from `www.youtube-nocookie.com`, Vimeo with `dnt=1`");
    says("**Image files** are requested with no referrer.");
    expect(shared).toContain("https://www.youtube-nocookie.com/embed/");
    expect(shared).toMatch(/https:\/\/player\.vimeo\.com\/video\/\$\{source\.id\}\?dnt=1/);
    expect(browser).toMatch(/"img",\s*\{[^}]*referrerPolicy: "no-referrer"/);
    expect(browser).toMatch(/"iframe",\s*\{[^}]*referrerPolicy: "strict-origin-when-cross-origin"/);
  });
});
