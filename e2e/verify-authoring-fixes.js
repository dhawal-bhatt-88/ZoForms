// The authoring fixes found while writing the docs (docs/briefs/BUILDER-BRIEF-AUTHORING-FIXES.md):
// Hidden field gone from the insert menu but still opening, saving and deleting; Respondent's
// country's canvas and keywords; display blocks no longer called "Question"; a new Matrix's
// rows; distinct default page titles; and the save rules for a linear scale's Min and Max and
// a number's Minimum and Maximum (API 400 naming the block, and the same message inline).
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
const walk = function* (bs) { for (const b of bs) { yield b; if (b.blocks) yield* walk(b.blocks); } };

(async () => {
  const email = `verify-authoring-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Authoring" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const put = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;

    // ---------- API: a Hidden field still saves (the renderer accepts the type) ----------
    const legacyId = await create("Referral");
    const r = await put(legacyId, { title: "Referral", blocks: [
      { id: "b_name0001", type: "short", label: "Your name", required: false },
      { id: "b_ref00001", type: "hidden", label: "Referral code" },
      { id: "b_cntry001", type: "country", label: "Where do you live?", required: false },
    ] });
    check("API: a form with a Hidden field still saves", r.status === 200, r.status);

    // ---------- API: a scale's and a number's range (contract §6, builder only) ----------
    const rangeId = await create("Range rules");
    const scaleQ = (min, max) => ({ id: "b_scale001", type: "scale", label: "How easy was booking?", required: false, min, max });
    const numberQ = (min, max) => ({ id: "b_numbr001", type: "number", label: "Age", required: false, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) });
    const refused = async (blocks, message, name) => {
      const res = await put(rangeId, { title: "t", blocks });
      const body = await res.json();
      check(`API: ${name} is refused (400) naming the block`, res.status === 400 && body.message === message, `${res.status} ${body.message}`);
    };
    await refused([scaleQ(5, 3)], `Block "How easy was booking?": Max (3) can't be less than Min (5).`, "a scale with Min above Max");
    await refused([scaleQ(1.5, 5)], `Block "How easy was booking?": Min must be a whole number, such as 0 or 1.`, "a scale with a decimal Min");
    await refused([scaleQ(1, 4.5)], `Block "How easy was booking?": Max must be a whole number, such as 5 or 10.`, "a scale with a decimal Max");
    await refused([scaleQ(1, 21)], `Block "How easy was booking?": a scale can have at most 20 points; 1 to 21 has 21. Lower Max or raise Min.`, "a scale of 21 points");
    await refused([numberQ(10, 5)], `Block "Age": Maximum (5) can't be less than Minimum (10).`, "a number with Minimum above Maximum");
    const ok = await put(rangeId, { title: "t", blocks: [scaleQ(-10, 9), numberQ(0.5, 120.5), { ...numberQ(), id: "b_numbr002", label: "Count" }] });
    const okStored = (await stored(rangeId)).blocks;
    check("API: a 20-point scale and a number with decimal limits save, limits kept",
      ok.status === 200 && okStored[1].min === 0.5 && okStored[1].max === 120.5 && !("min" in okStored[2]), `${ok.status} ${JSON.stringify(okStored)}`);

    // ---------- editor ----------
    browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    const card = (id) => P.locator(`[data-block-id="${id}"]`);
    const inspectorHeading = () => P.locator("aside h2").first().textContent();
    const logicSays = (noun) => P.locator("aside").getByText(`Show this ${noun} only when…`, { exact: true }).isVisible();
    const openMenu = async () => { await P.getByTitle("Insert a block").click(); await P.getByPlaceholder("Search blocks…").waitFor(); };
    const menuOptions = () => P.locator('[data-block-menu] [role="option"] [data-label]').allTextContents();
    const search = async (q) => { await P.getByPlaceholder("Search blocks…").fill(q); await sleep(100); return menuOptions(); };
    const add = async (name) => { await openMenu(); await P.getByRole("option", { name, exact: true }).click(); };
    const save = async () => { await P.getByRole("button", { name: "Save", exact: true }).click(); await P.getByText("All changes saved").waitFor({ timeout: 10000 }); };

    await P.goto(`${WEB}/app/forms/${legacyId}/edit`);
    await P.getByText("All changes saved").waitFor();

    // Fix 1: the insert menu.
    await openMenu();
    const everything = await menuOptions();
    check("menu: Hidden field isn't offered", everything.length > 0 && !everything.includes("Hidden field"), JSON.stringify(everything));
    for (const q of ["hidden", "prefill"]) {
      const found = await search(q);
      check(`menu: "${q}" matches nothing`, found.length === 0 && await P.getByText(`No blocks match “${q}”.`).isVisible(), JSON.stringify(found));
    }
    // Fix 2: no keyword suggests the country is detected.
    for (const q of ["geo", "location"]) {
      const found = await search(q);
      check(`menu: "${q}" doesn't find Respondent's country`, !found.includes("Respondent's country"), JSON.stringify(found));
    }
    check('menu: "country" and "nation" find Respondent\'s country',
      JSON.stringify(await search("country")) === '["Respondent\'s country"]' && JSON.stringify(await search("nation")) === '["Respondent\'s country"]');
    await P.keyboard.press("Escape");

    // Fix 1: an existing Hidden field opens, says what it does, saves and deletes.
    const hiddenText = "Hidden field — not shown to respondents, and no value is collected or submitted yet.";
    check("hidden: the canvas says it isn't shown, collected or submitted yet", await card("b_ref00001").getByText(hiddenText, { exact: true }).isVisible());
    await card("b_ref00001").locator("span.truncate").first().click();
    check('hidden: the inspector is headed "Hidden field", not "Question"', (await inspectorHeading()) === "Hidden field", await inspectorHeading());
    check('hidden: Logic says "Show this hidden field only when…"', await logicSays("hidden field"));
    await P.locator("#block-label").fill("Referral source");
    await save();
    check("hidden: an edited Hidden field saves", [...walk((await stored(legacyId)).blocks)].some((b) => b.type === "hidden" && b.label === "Referral source"));

    // Fix 2: the canvas shows what respondents see.
    const country = card("b_cntry001");
    check('country: the canvas shows a select reading "Select a country…"', await country.getByText("Select a country…", { exact: true }).isVisible());
    check('country: …and says "15 countries, and Other"', await country.getByText("15 countries, and Other", { exact: true }).isVisible());
    check('country: nothing says "Auto-detected"', (await P.getByText(/auto-detected/i).count()) === 0);
    await P.screenshot({ path: `${OUT}/authoring-1-hidden-and-country.png` });

    await card("b_ref00001").locator("span.truncate").first().click();
    await card("b_ref00001").getByRole("button", { name: "Delete", exact: true }).click();
    await save();
    check("hidden: deleting it saves without it", ![...walk((await stored(legacyId)).blocks)].some((b) => b.type === "hidden"));

    // Fix 5: blocks that ask nothing are named by their type, never "Question".
    for (const [item, heading, noun] of [
      ["Heading 2", "Heading", "heading block"],
      ["Divider", "Divider", "divider block"],
      ["Title", "Title", "title block"],
      ["Label", "Label", "label block"],
      ["Text", "Text", "text block"],
    ]) {
      await add(item);
      check(`${heading}: the inspector is headed "${heading}"`, (await inspectorHeading()) === heading, await inspectorHeading());
      check(`${heading}: Logic says "Show this ${noun} only when…"`, await logicSays(noun));
    }
    check('the canvas names a heading "Edit heading: …", not "Edit question"',
      (await P.getByRole("button", { name: "Edit heading: Section heading", exact: true }).count()) === 1);
    await add("Short answer");
    check('a question is still headed "Question", with "Show this question only when…"', (await inspectorHeading()) === "Question" && await logicSays("question"));
    await P.screenshot({ path: `${OUT}/authoring-2-display-heading.png` });

    // Fix 7: a new Matrix's rows are rows; Add row continues them; codes stay empty.
    await add("Matrix");
    const rowLabels = () => P.locator('aside input[id^="options-"][id$="-label"]').evaluateAll((es) => es.map((e) => e.value));
    const rowCodes = () => P.locator('aside input[id^="options-"][id$="-code"]').evaluateAll((es) => es.map((e) => e.value));
    check("matrix: new rows are Row 1, Row 2 and Row 3", JSON.stringify(await rowLabels()) === '["Row 1","Row 2","Row 3"]', JSON.stringify(await rowLabels()));
    check("matrix: …with empty codes", (await rowCodes()).every((c) => c === ""), JSON.stringify(await rowCodes()));
    check("matrix: columns keep Column 1–3",
      JSON.stringify(await P.locator('aside input[id^="columns-"][id$="-label"]').evaluateAll((es) => es.map((e) => e.value))) === '["Column 1","Column 2","Column 3"]');
    await P.getByRole("button", { name: "Add row", exact: true }).click();
    check('matrix: Add row gives "Row 4"', (await rowLabels())[3] === "Row 4", JSON.stringify(await rowLabels()));
    await P.screenshot({ path: `${OUT}/authoring-3-matrix-rows.png` });
    await save();

    // Fix 8: distinct default page titles.
    const pageTitles = () => P.locator("[data-page-box] input[aria-label$=' title']").evaluateAll((es) => es.map((e) => e.value));
    await P.getByRole("button", { name: "Add page", exact: true }).click();
    await P.getByRole("dialog").getByRole("button", { name: "Add pages" }).click();
    check('split into pages: "Page 1" and "Page 2"', JSON.stringify(await pageTitles()) === '["Page 1","Page 2"]', JSON.stringify(await pageTitles()));
    await P.locator('input[aria-label="Page 2 title"]').fill("Page 3");
    await P.getByRole("button", { name: 'Add page after "Page 3"' }).click();
    check('a page added when "Page 3" is taken is "Page 4"', JSON.stringify(await pageTitles()) === '["Page 1","Page 3","Page 4"]', JSON.stringify(await pageTitles()));
    await P.screenshot({ path: `${OUT}/authoring-4-page-titles.png` });

    // ---------- fixes 3 and 6 in the editor: the same rules and messages, under their fields ----------
    const bookingId = await create("Booking");
    await P.goto(`${WEB}/app/forms/${bookingId}/edit`);
    await P.getByText("All changes saved").waitFor();
    const fieldError = (id) => P.locator(`#${id}-error`);
    const errorText = async (id) => ((await fieldError(id).count()) ? (await fieldError(id).innerText()).trim() : null);
    const redMessages = () => P.locator("aside [data-field-error]").count();
    const timesShown = async (phrase) => (await P.locator("aside").innerText()).split(phrase).length - 1;
    const notice = P.getByRole("alert").filter({ hasText: /Couldn't save/ });
    const refusedSave = async () => {
      await P.getByRole("button", { name: "Save", exact: true }).click();
      await notice.waitFor({ timeout: 10000 });
      const text = (await notice.innerText()).trim();
      await P.getByRole("button", { name: "Dismiss" }).click();
      return text;
    };

    await add("Linear scale");
    await P.locator("#block-label").fill("How easy was booking?");
    check("scale: the inspector says Min and Max are whole numbers, at most 20 points",
      (await P.locator("#scale-range-help").innerText()) === "Whole numbers. Respondents see every point from Min to Max, at most 20."
      && (await P.locator("#scale-min").getAttribute("aria-describedby")).includes("scale-range-help"));
    await P.locator("#scale-max").fill("3");
    await P.locator("#scale-min").fill("5");
    check("scale: Min above Max shows under Max", (await errorText("scale-max")) === "Max (3) can't be less than Min (5)." && (await errorText("scale-min")) === null, await errorText("scale-max"));
    check("scale: …as an alert, with Max marked invalid", (await fieldError("scale-max").getAttribute("role")) === "alert" && (await P.locator("#scale-max").getAttribute("aria-invalid")) === "true");
    check("scale: …shown once, not again under Logic", (await timesShown("can't be less than Min")) === 1 && (await redMessages()) === 1);
    await P.screenshot({ path: `${OUT}/authoring-5-scale-error.png` });
    const scaleRefusal = await refusedSave();
    check("scale: the save is refused with the same message, naming the block",
      scaleRefusal === `Couldn't save: Block "How easy was booking?": Max (3) can't be less than Min (5).`, scaleRefusal);
    await P.locator("#scale-min").fill("1.5");
    check("scale: a decimal Min shows under Min, and no range message on top",
      (await errorText("scale-min")) === "Min must be a whole number, such as 0 or 1." && (await errorText("scale-max")) === null);
    await P.locator("#scale-min").fill("1");
    await P.locator("#scale-max").fill("30");
    check("scale: more than 20 points shows under Max, with the count",
      (await errorText("scale-max")) === "A scale can have at most 20 points; 1 to 30 has 30. Lower Max or raise Min.", await errorText("scale-max"));
    await P.locator("#scale-max").fill("20");
    check("scale: 1 to 20 is fine: no message", (await redMessages()) === 0);
    const points = await P.locator("[data-block-id]").first().locator("span.h-8.w-8").allTextContents();
    check("scale: the canvas shows all 20 points, as respondents see them", points.length === 20 && points[19] === "20", JSON.stringify(points));

    await add("Number");
    await P.locator("#block-label").fill("Age");
    check("number: Minimum and Maximum are offered, empty, and marked optional",
      (await P.locator("#number-min").inputValue()) === "" && (await P.locator("#number-max").inputValue()) === ""
      && (await P.getByLabel("Minimum optional", { exact: true }).count()) === 1 && (await P.getByLabel("Maximum optional", { exact: true }).count()) === 1);
    check("number: the hint says blank is no limit and decimals are allowed",
      (await P.locator("#number-range-help").innerText()) === "Leave blank for no limit. Decimals and negative numbers are allowed.");
    await P.locator("#number-min").fill("10");
    await P.locator("#number-max").fill("5");
    check("number: Minimum above Maximum shows under Maximum", (await errorText("number-max")) === "Maximum (5) can't be less than Minimum (10)." && (await redMessages()) === 1, await errorText("number-max"));
    await P.screenshot({ path: `${OUT}/authoring-6-number-error.png` });
    const numberRefusal = await refusedSave();
    check("number: the save is refused with the same message, naming the block",
      numberRefusal === `Couldn't save: Block "Age": Maximum (5) can't be less than Minimum (10).`, numberRefusal);
    await P.locator("#number-min").fill("-0.5");
    await P.locator("#number-max").fill("120.5");
    check("number: decimal and negative limits are fine", (await redMessages()) === 0);
    await save();
    let saved = [...walk((await stored(bookingId)).blocks)];
    const savedScale = saved.find((b) => b.type === "scale");
    const savedNumber = saved.find((b) => b.type === "number");
    check("saved: the scale's 1 to 20, and the number's -0.5 to 120.5",
      savedScale.min === 1 && savedScale.max === 20 && savedNumber.min === -0.5 && savedNumber.max === 120.5, JSON.stringify([savedScale, savedNumber]));
    await P.locator("#number-min").fill("");
    await save();
    saved = [...walk((await stored(bookingId)).blocks)];
    const clearedNumber = saved.find((b) => b.type === "number");
    check("saved: a cleared Minimum is left out, the Maximum kept", !("min" in clearedNumber) && clearedNumber.max === 120.5, JSON.stringify(clearedNumber));
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const p = browser?.contexts()[0]?.pages()[0]; if (p) await p.screenshot({ path: `${OUT}/authoring-failure.png` }); } catch {}
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
