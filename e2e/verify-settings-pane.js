// The editor's resizable settings pane (builder only, not in the contract): the
// handle's ARIA (W3C APG window splitter), drag and keyboard resizing, Home/End,
// the double-click reset, one debounced save per adjustment, the width after a
// reload and in a second browser, clamping to the screen's limits, and a failed
// save that doesn't interrupt editing.
const { API, WEB, PrismaClient, launchBrowser, opts } = require("./_setup");
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

const VIEWPORT = { width: 1440, height: 1000 };
const MAX = VIEWPORT.width / 2; // 720
const MIN = 280;
const DEFAULT = 300;
const SETTLE = 1200; // longer than the editor's 500ms save delay

(async () => {
  const email = `verify-settings-pane-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Pane" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Pane" }) })).json();
    await fetch(`${API}/v1/forms/${form.id}/schema`, {
      method: "PUT", headers: H,
      body: JSON.stringify({ title: "Pane", blocks: [{ id: "q", type: "choice", label: "A question with options", required: false, options: opts("Yes", "No") }] }),
    });
    const stored = async () => (await prisma.user.findUnique({ where: { email } })).settingsPaneWidth;

    browser = await launchBrowser();
    const newContext = async () => {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
      await ctx.addInitScript(() => {
        const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
        if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
        // Every width the pane has from the moment it appears, frame by frame, for the first second.
        window.__paneWidths = [];
        const started = performance.now();
        const sample = () => {
          const el = document.getElementById("settings-pane");
          if (el) window.__paneWidths.push(Math.round(el.getBoundingClientRect().width));
          if (performance.now() - started < 4000 && (!el || window.__paneWidths.length < 60)) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      return ctx;
    };
    const ctx = await newContext();
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    P.on("dialog", (d) => d.accept());
    const saves = [];
    P.on("request", (r) => {
      if (r.method() === "PATCH" && r.url().endsWith("/v1/auth/me/preferences")) saves.push(JSON.parse(r.postData()).settingsPaneWidth);
    });
    const warnings = [];
    P.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));

    const pane = P.locator("#settings-pane");
    const handle = P.getByRole("separator", { name: "Field settings" });
    const width = async () => Math.round((await pane.boundingBox()).width);
    const attr = (name) => handle.getAttribute(name);
    const open = async () => {
      await P.goto(`${WEB}/app/forms/${form.id}/edit`);
      await P.getByText("All changes saved").waitFor();
    };
    const drag = async (dx) => {
      const box = await handle.boundingBox();
      const x = box.x + box.width / 2, y = box.y + 200;
      await P.mouse.move(x, y);
      await P.mouse.down();
      for (let k = 1; k <= 10; k++) await P.mouse.move(x + (dx * k) / 10, y);
      const during = await P.evaluate(() => ({
        resizing: document.documentElement.classList.contains("pane-resizing"),
        cursor: getComputedStyle(document.querySelector("#settings-pane label") ?? document.body).cursor,
        selection: String(getSelection()),
      }));
      await P.mouse.up();
      return during;
    };

    // ---------- default and ARIA ----------
    await open();
    check("a new account's pane is the default 300px", (await width()) === DEFAULT, `${await width()}`);
    check("the pane is a landmark named Field settings", (await P.getByRole("complementary", { name: "Field settings" }).count()) === 1);
    check("the handle is a separator with the pane's name", (await handle.count()) === 1);
    check("aria-orientation is vertical", (await attr("aria-orientation")) === "vertical");
    check("aria-controls points at the pane", (await attr("aria-controls")) === "settings-pane");
    check("aria-valuenow is the pane's width in px", (await attr("aria-valuenow")) === String(DEFAULT), await attr("aria-valuenow"));
    check(`aria-valuemin is ${MIN} and aria-valuemax half the viewport (${MAX})`,
      (await attr("aria-valuemin")) === String(MIN) && (await attr("aria-valuemax")) === String(MAX),
      `${await attr("aria-valuemin")}–${await attr("aria-valuemax")}`);
    check("aria-valuetext says the width in pixels", (await attr("aria-valuetext")) === `${DEFAULT} pixels`);
    check("the handle is focusable (tabindex 0)", (await attr("tabindex")) === "0");

    // Tab order: Shift+Tab from the pane's first control reaches the handle, with a visible focus ring.
    await pane.locator("input, select, textarea, button").first().focus();
    await P.keyboard.press("Shift+Tab");
    const focused = await P.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { role: el.getAttribute("role"), shadow: cs.boxShadow, outline: cs.outlineStyle, visible: el.matches(":focus-visible") };
    });
    check("Shift+Tab from the pane's first control focuses the handle", focused.role === "separator", JSON.stringify(focused));
    check("the focused handle shows a focus ring", focused.visible && focused.shadow !== "none" && /rgb/.test(focused.shadow), JSON.stringify(focused));

    // ---------- keyboard ----------
    saves.length = 0;
    await P.keyboard.press("ArrowLeft");
    check("ArrowLeft widens the pane by 16px", (await width()) === DEFAULT + 16 && (await attr("aria-valuenow")) === String(DEFAULT + 16), `${await width()}`);
    await P.keyboard.press("ArrowLeft");
    await P.keyboard.press("ArrowLeft");
    await P.keyboard.press("ArrowRight");
    check("ArrowRight narrows it by 16px", (await width()) === DEFAULT + 32, `${await width()}`);
    await sleep(SETTLE);
    check("four key presses in a row save once, with the final width", saves.length === 1 && saves[0] === DEFAULT + 32, JSON.stringify(saves));
    check("the account holds it", (await stored()) === DEFAULT + 32, `${await stored()}`);

    saves.length = 0;
    await P.keyboard.press("Home");
    check("Home jumps to the minimum (280px)", (await width()) === MIN && (await attr("aria-valuenow")) === String(MIN), `${await width()}`);
    await P.keyboard.press("ArrowRight");
    check("ArrowRight at the minimum stays there", (await width()) === MIN);
    await P.keyboard.press("End");
    check(`End jumps to the maximum (${MAX}px)`, (await width()) === MAX && (await attr("aria-valuenow")) === String(MAX), `${await width()}`);
    await P.keyboard.press("ArrowLeft");
    check("ArrowLeft at the maximum stays there", (await width()) === MAX);
    await P.keyboard.press("Enter");
    check("Enter does nothing (no collapse)", (await width()) === MAX && (await handle.evaluate((el) => el === document.activeElement)));
    await sleep(SETTLE);
    check("Home then End saves once, the maximum", saves.length === 1 && saves[0] === MAX && (await stored()) === MAX, JSON.stringify(saves));

    // ---------- drag ----------
    await P.keyboard.press("Home");
    await sleep(SETTLE);
    saves.length = 0;
    const during = await drag(-120);
    check("dragging the handle 120px left widens the pane by 120px", (await width()) === MIN + 120, `${await width()}`);
    check("aria-valuenow follows the drag", (await attr("aria-valuenow")) === String(MIN + 120));
    check("while dragging the cursor is col-resize over the page", during.resizing && during.cursor === "col-resize", JSON.stringify(during));
    check("dragging selects no text", during.selection === "", JSON.stringify(during.selection));
    check("the drag style is gone after the drag", !(await P.evaluate(() => document.documentElement.classList.contains("pane-resizing"))));
    await sleep(SETTLE);
    check("a drag saves once, when it ends, with the final width", saves.length === 1 && saves[0] === MIN + 120 && (await stored()) === MIN + 120, JSON.stringify(saves));

    saves.length = 0;
    await drag(-1000);
    check(`a drag past the maximum stops at ${MAX}px`, (await width()) === MAX, `${await width()}`);
    await drag(2000);
    check(`a drag past the minimum stops at ${MIN}px`, (await width()) === MIN, `${await width()}`);
    await sleep(SETTLE);
    check("two drags in quick succession save once, the last width", saves.length === 1 && saves[0] === MIN, JSON.stringify(saves));
    saves.length = 0;
    const box = await handle.boundingBox();
    await P.mouse.click(box.x + box.width / 2, box.y + 200);
    await sleep(SETTLE);
    check("a click on the handle without moving saves nothing", saves.length === 0, JSON.stringify(saves));

    // ---------- reset ----------
    saves.length = 0;
    await handle.dblclick();
    check("double-clicking the handle restores the default width", (await width()) === DEFAULT, `${await width()}`);
    await sleep(SETTLE);
    check("the reset clears the saved width (null, not 300)", saves.length === 1 && saves[0] === null && (await stored()) === null, `${JSON.stringify(saves)} ${await stored()}`);

    // ---------- survives a reload, with no jump ----------
    await drag(-152);
    await sleep(SETTLE);
    check("dragged to 452px and saved", (await stored()) === 452, `${await stored()}`);
    await open();
    const seen = await P.evaluate(() => window.__paneWidths);
    check("after a reload the pane is 452px", (await width()) === 452, `${await width()}`);
    check("from its first frame: no jump after the first paint", seen.length > 0 && seen.every((w) => w === 452), JSON.stringify(seen.slice(0, 12)));

    // ---------- follows the account to another browser ----------
    const ctx2 = await newContext();
    const P2 = await ctx2.newPage();
    await P2.goto(`${WEB}/app/forms/${form.id}/edit`);
    await P2.getByText("All changes saved").waitFor();
    check("a second browser signed in to the account opens at 452px", Math.round((await P2.locator("#settings-pane").boundingBox()).width) === 452);
    await ctx2.close();

    // ---------- clamped to this screen, without saving the clamp ----------
    await prisma.user.update({ where: { email }, data: { settingsPaneWidth: 1500 } });
    saves.length = 0;
    await open();
    const seenWide = await P.evaluate(() => window.__paneWidths);
    check(`a saved 1500px is shown at this screen's maximum (${MAX}px)`, (await width()) === MAX && (await attr("aria-valuenow")) === String(MAX), `${await width()}`);
    check("held from the first frame", seenWide.length > 0 && seenWide.every((w) => w === MAX), JSON.stringify(seenWide.slice(0, 12)));
    await P.setViewportSize({ width: 1000, height: 1000 });
    await sleep(200);
    check("a narrower window lowers the maximum to half of it (500px) and holds the pane there", (await width()) === 500 && (await attr("aria-valuemax")) === "500", `${await width()} ${await attr("aria-valuemax")}`);
    await P.setViewportSize({ width: 500, height: 1000 });
    await sleep(200);
    check("when half the window is under 280px, the minimum wins", (await width()) === MIN && (await attr("aria-valuemin")) === String(MIN) && (await attr("aria-valuemax")) === String(MIN), `${await width()} ${await attr("aria-valuemax")}`);
    await P.setViewportSize(VIEWPORT);
    await sleep(SETTLE);
    check("back at full width it is at the maximum again", (await width()) === MAX);
    check("clamping saved nothing: the account still holds 1500", saves.length === 0 && (await stored()) === 1500, `${JSON.stringify(saves)} ${await stored()}`);

    // ---------- a failed save doesn't interrupt editing ----------
    await P.route("**/v1/auth/me/preferences", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"Down for the test."}' }));
    warnings.length = 0;
    const alertsBefore = await P.getByRole("alert").allTextContents();
    await handle.focus();
    await P.keyboard.press("Home");
    await P.keyboard.press("ArrowLeft");
    await sleep(SETTLE);
    check("with the save failing, the new width stays", (await width()) === MIN + 16, `${await width()}`);
    check("the failure is logged", warnings.some((w) => w.includes("Couldn't save the settings pane width")), JSON.stringify(warnings));
    const alertsAfter = await P.getByRole("alert").allTextContents();
    check("and nothing is shown to the author", JSON.stringify(alertsAfter) === JSON.stringify(alertsBefore) && !(await P.getByText("Down for the test.").count()), JSON.stringify(alertsAfter));
    await P.getByRole("banner").getByRole("textbox", { name: "Form title" }).fill("Pane, still editing");
    check("editing carries on: the change is there and unsaved", !(await P.getByText("All changes saved").count()), "");
    check("the account still holds the last width that saved", (await stored()) === 1500, `${await stored()}`);
    await P.unroute("**/v1/auth/me/preferences");
    await ctx.close();
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    if (browser) await browser.close().catch(() => {});
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
