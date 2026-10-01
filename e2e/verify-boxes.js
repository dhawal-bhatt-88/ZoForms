// Boxed groups on the editor canvas (Edge): boxes, shades, collapse, empty group,
// drop highlight while dragging, deep nesting, narrow widths.
const { OUT, API, WEB, PrismaClient, launchBrowser } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url) {
  for (let i = 0; i < 180; i++) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await sleep(1000);
  }
  throw new Error("server not up: " + url);
}

const leaf = (id, label, type = "short", extra = {}) => ({ id, type, label, required: false, ...extra });
const group = (id, label, blocks, extra = {}) => ({ id, type: "group", label, blocks, ...extra });
const YN = { options: ["Yes", "No"] };
const MAIN = {
  title: "Health intake",
  blocks: [
    leaf("meds", "Do you take any regular medication?", "choice", YN),
    group("g_med", "Medication", [
      leaf("med_name", "Medication name"),
      group("g_dose", "Dosage", [
        leaf("dose", "Dose (mg)", "number"),
        group("g_sched", "Schedule", [leaf("freq", "How often?", "dropdown", { options: ["Once daily", "Twice daily"] }), leaf("food", "Taken with food?", "choice", YN)]),
      ]),
    ], { enableWhen: [{ question: "meds", operator: "=", answer: "Yes" }] }),
    group("g_all", "Allergies", [leaf("allergy", "Allergy"), leaf("reaction", "Reaction")]),
    leaf("notes", "Notes"),
  ],
};
// Nine levels deep: indentation stops after six, the "Level N" chip takes over.
let deepest = [leaf("deep_q", "The deepest question")];
for (let i = 9; i >= 1; i--) deepest = [group(`d${i}`, `Level ${i} group`, deepest)];
const DEEP = { title: "Deep nesting", blocks: [leaf("top", "Top question"), ...deepest] };

(async () => {
  const email = `verify-boxes-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Boxes" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const make = async (schema) => {
      const f = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: schema.title }) })).json();
      const r = await fetch(`${API}/v1/forms/${f.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
      if (!r.ok) throw new Error(`save ${schema.title}: ${r.status} ${await r.text()}`);
      return f.id;
    };
    const mainId = await make(MAIN);
    const deepId = await make(DEEP);

    browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("no page errors", false, e.message));

    const card = (id) => page.locator(`[data-block-id="${id}"]`);
    const box = (id) => page.locator(`[data-group-box="${id}"]`);
    const deselect = () => page.locator('input[placeholder="Add a description…"]').click();
    const open = async (id) => { await page.goto(`${WEB}/app/forms/${id}/edit`); await page.getByText("All changes saved").waitFor(); };
    const canvas = page.locator("div.overflow-auto").first();

    // ---------- 1. three levels of boxes ----------
    await open(mainId);
    check("every group renders as a box", (await page.locator("[data-group-box]").count()) === 4);
    const inside = await page.evaluate(() => {
      const box = (id) => document.querySelector(`[data-group-box="${id}"]`);
      const card = (id) => document.querySelector(`[data-block-id="${id}"]`);
      return {
        header: box("g_dose").contains(card("g_dose")),
        nested: box("g_med").contains(box("g_dose")) && box("g_dose").contains(box("g_sched")),
        leaf: box("g_sched").contains(card("freq")) && !box("g_sched").contains(card("dose")),
        outside: !box("g_all").contains(card("notes")) && !box("g_med").contains(card("meds")),
        addInside: box("g_sched").contains([...document.querySelectorAll("button")].find((b) => b.textContent.includes('Add to "Schedule"'))),
      };
    });
    check("header, contents, nested boxes and the Add button sit inside their box; the rest doesn't", Object.values(inside).every(Boolean), JSON.stringify(inside));
    const style = await page.evaluate(() => ["g_med", "g_dose", "g_sched", "g_all"].map((id) => {
      const s = getComputedStyle(document.querySelector(`[data-group-box="${id}"]`));
      return { bg: s.backgroundColor, border: s.borderTopWidth + " " + s.borderLeftWidth + " " + s.borderBottomWidth + " " + s.borderRightWidth, radius: s.borderTopLeftRadius, pad: s.paddingLeft };
    }));
    check("full border, rounded corners and padding on each box", style.every((s) => s.border === "1px 1px 1px 1px" && parseFloat(s.radius) >= 8 && parseFloat(s.pad) >= 8), JSON.stringify(style));
    check("nested boxes alternate between two shades", style[0].bg !== style[1].bg && style[0].bg === style[2].bg && style[3].bg === style[0].bg, style.map((s) => s.bg).join(" / "));
    check("no thin rail any more", (await page.locator("span.w-\\[2px\\]").count()) === 0);
    await page.screenshot({ path: `${OUT}/boxes-1-three-levels.png` });

    // ---------- 2. collapsed group ----------
    await card("g_all").getByRole("button", { name: 'Collapse group "Allergies"' }).click();
    check("a collapsed group is one closed box: header only, with the count",
      (await card("allergy").count()) === 0 && await box("g_all").getByText("2 blocks inside").isVisible()
      && (await box("g_all").getByRole("button", { name: /Add to/ }).count()) === 0);
    const collapsedH = (await box("g_all").boundingBox()).height;
    check("collapsed box is just its header", collapsedH < 70, String(collapsedH));
    await box("g_all").evaluate((e) => e.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: `${OUT}/boxes-2-collapsed.png` });
    await card("g_all").getByRole("button", { name: 'Expand group "Allergies"' }).click();

    // ---------- 3. empty group ----------
    await deselect();
    await page.getByTitle("Insert a block").click();
    await page.getByRole("button", { name: "Group", exact: true }).click();
    await page.locator("#block-label").fill("Travel");
    await deselect();
    const travel = page.locator("[data-group-box]").last();
    check("an empty group is a box with its message inside",
      await travel.getByRole("button", { name: '"Travel" is empty — add a block to it' }).isVisible());
    await travel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/boxes-3-empty-group.png` });
    await travel.locator("[data-block-id]").hover();
    await travel.getByRole("button", { name: "Delete group" }).click();
    await page.getByRole("button", { name: /Group only/ }).click();

    // ---------- 4. drag in progress: the box that will receive the drop ----------
    await canvas.evaluate((el) => el.scrollTo(0, 0));
    const from = card("notes");
    await from.scrollIntoViewIfNeeded();
    await from.hover();
    const grip = await from.getByRole("button", { name: "Drag to reorder" }).boundingBox();
    const fromBox = await from.boundingBox();
    const toBox = await card("g_all").boundingBox();
    const sx = grip.x + grip.width / 2, sy = grip.y + grip.height / 2;
    const ty = toBox.y + toBox.height / 2 + (sy - (fromBox.y + fromBox.height / 2));
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 8, sy + 2, { steps: 3 });
    const targets = {};
    // Sideways movement picks the depth; each step should light up a different box.
    for (const [dx, expect] of [[0, null], [28, "g_med"], [56, "g_dose"], [84, "g_sched"]]) {
      await page.mouse.move(sx + dx, ty, { steps: 12 });
      await sleep(250);
      const lit = await page.locator("[data-drop-target]").evaluateAll((els) => els.map((e) => e.getAttribute("data-group-box")));
      const lines = await page.locator("[data-drop-line]").count();
      targets[dx] = `${lit.join(",") || "none"} (${lines} line)`;
      check(`while dragging ${dx}px right, ${expect ? `only "${expect}" is highlighted` : "no box is highlighted (top level)"}, with one drop line`,
        JSON.stringify(lit) === JSON.stringify(expect ? [expect] : []) && lines === 1, JSON.stringify(targets));
      if (dx === 56) await page.screenshot({ path: `${OUT}/boxes-4-drag-in-progress.png` });
    }
    check("the dragged card stays in place, dimmed; a copy follows the pointer",
      (await from.evaluate((e) => getComputedStyle(e).opacity)) < 1 && (await page.locator("[data-block-id=notes]").count()) === 1);
    await page.mouse.move(sx + 56, ty, { steps: 6 });
    await sleep(200);
    await page.mouse.up();
    await sleep(400);
    const landed = await page.evaluate(() => {
      const box = document.querySelector('[data-group-box="g_dose"]');
      const cards = [...box.querySelectorAll("[data-block-id]")].map((c) => c.getAttribute("data-block-id"));
      return cards.join(",");
    });
    check("dropping lands the block in the highlighted box, at the line", landed === "g_dose,dose,g_sched,freq,food,notes", landed);
    check("nothing stays highlighted after the drop", (await page.locator("[data-drop-target], [data-drop-line]").count()) === 0);

    // ---------- 5. deep nesting, and narrow widths ----------
    for (const width of [1440, 1024, 900]) {
      await page.setViewportSize({ width, height: 900 });
      await open(deepId);
      const m = await page.evaluate(() => {
        const c = document.querySelector("div.overflow-auto");
        const q = document.querySelector('[data-block-id="deep_q"]').getBoundingClientRect();
        const top = document.querySelector('[data-block-id="top"]').getBoundingClientRect();
        const l6 = document.querySelector('[data-block-id="d7"]').getBoundingClientRect();
        const l9 = document.querySelector('[data-block-id="d9"]').getBoundingClientRect();
        const overflow = [...document.querySelectorAll("[data-block-id]")].some((el) => el.scrollWidth > el.clientWidth + 1);
        return { hscroll: c.scrollWidth > c.clientWidth, deepWidth: Math.round(q.width), topWidth: Math.round(top.width), indent6: Math.round(l6.left - top.left), indent9: Math.round(l9.left - top.left), overflow };
      });
      check(`${width}px: no sideways scroll or overflowing cards`, !m.hscroll && !m.overflow, JSON.stringify(m));
      check(`${width}px: indentation stops growing after six levels`, Math.abs(m.indent9 - m.indent6) <= 3, JSON.stringify(m));
      check(`${width}px: the deepest question stays at least 300px wide`, m.deepWidth >= 300, JSON.stringify(m)); console.log(`    ${width}px: ${JSON.stringify(m)}`);
      if (width === 1024) {
        check("Level N chip beyond six levels", await card("deep_q").getByText("Level 10", { exact: true }).isVisible() && await card("d8").getByText("Level 8", { exact: true }).isVisible());
        await card("deep_q").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${OUT}/boxes-5-deep-1024.png` });
      }
      if (width === 900) {
        await open(mainId);
        const m2 = await page.evaluate(() => {
          const c = document.querySelector("div.overflow-auto");
          return { hscroll: c.scrollWidth > c.clientWidth, food: Math.round(document.querySelector('[data-block-id="food"]').getBoundingClientRect().width) };
        });
        check("900px: the three-level form fits", !m2.hscroll && m2.food > 300, JSON.stringify(m2));
        await page.screenshot({ path: `${OUT}/boxes-6-main-900.png` });
      }
    }
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const p = browser?.contexts()[0]?.pages()[0]; if (p) await p.screenshot({ path: `${OUT}/boxes-failure.png` }); } catch {}
  } finally {
    if (browser) await browser.close();
    const u = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    if (u) {
      for (const m of u.memberships) await prisma.organization.delete({ where: { id: m.orgId } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
  for (const [name, pass, detail] of results) console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${!pass && detail ? "   [" + detail + "]" : ""}`);
  console.log(`\n  ${results.filter((r) => r[1]).length}/${results.length} passed`);
  process.exit(results.every((r) => r[1]) ? 0 : 1);
})();
