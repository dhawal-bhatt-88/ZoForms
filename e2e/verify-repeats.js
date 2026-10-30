// Repeating groups (contract §12): every save rule through the API, the editor's Repeats
// toggle, fields, inline errors, badge, source picker and dependency guards, the artifact,
// and — when E2E_EXTERNAL_APP_URL is set — rendering the download with @zoworkhq/forms.
const fs = require("fs");
const path = require("path");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact, opts, noIds, ZF_RENDERER, rendererVersion, atLeast } = require("./_setup");
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
const find = (blocks, id) => [...walk(blocks)].find((b) => b.id === id);

// The test app's page, e.g. http://localhost:5173/external-test-app/. Unset: the render step is skipped.
const EXTERNAL_APP = process.env.E2E_EXTERNAL_APP_URL;
const ARTIFACT = "builder-repeats-schema.json";

const q = (id, type, label, extra = {}) => ({ id, type, label, required: false, ...extra });
const yn = (id, label, extra = {}) => q(id, "choice", label, { options: opts("Yes", "No"), ...extra });
const group = (id, label, blocks, extra = {}) => ({ id, type: "group", label, blocks, ...extra });
const page = (id, title, blocks, extra = {}) => ({ id, type: "page", title, blocks, ...extra });
const eq = (question, answer) => ({ question, operator: "=", answer });
const answered = (question) => ({ question, operator: "exists" });

const PREFIX = (kind, path, source, group, one, fix) =>
  `${kind} "${path}": its condition uses "${source}", which is inside the repeating group "${group}". This ${kind.toLowerCase()} isn't inside "${group}", so it can't tell which ${one}'s answer to use. ${fix}`;

/*
 * The paged form the editor turns into repeating groups. Every group starts plain; the
 * suite switches Repeats on in the inspector:
 *   Patients (1–3) › Payments (0 or more) › Line items (1 or more) — a three-level nest;
 *   Children (0 or more), inside the plain group Household, shown only when hasKids = Yes.
 * "Follow-up" starts with a condition on a patient's name, which must block turning
 * Repeats on for Patients until it is removed.
 */
const seed = () => ({
  title: "Clinic visit",
  blocks: [
    page("p1", "About you", [yn("consent", "Do you agree to share details?"), yn("hasKids", "Do you have children?")]),
    page("p2", "Patients", [
      group("patients", "Patients", [
        q("pname", "short", "Patient name"),
        yn("insured", "Is this patient insured?"),
        group("payments", "Payments", [
          q("amount", "number", "Amount"),
          group("items", "Line items", [
            q("desc", "short", "Description", { enableWhen: [eq("consent", "yes")] }),
            q("cost", "number", "Cost"),
          ]),
          q("refund", "short", "Refund reason"),
        ]),
        q("pnote", "short", "Notes about this patient"),
      ]),
      q("followup", "short", "Follow-up", { enableWhen: [answered("pname")] }),
    ]),
    page("p3", "Household", [
      group("household", "Household", [
        q("address", "short", "Address"),
        group("kids", "Children", [q("kname", "short", "Child's name"), q("kage", "number", "Child's age"), q("allergy", "short", "Allergies")],
          { enableWhen: [eq("hasKids", "yes")] }),
      ]),
      q("final", "short", "Anything else?", { enableWhen: [eq("consent", "yes")] }),
    ]),
  ],
});

(async () => {
  const email = `verify-repeats-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Repeats" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const put = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;
    const remove = (id) => fetch(`${API}/v1/forms/${id}`, { method: "DELETE", headers: H });

    // ================= API =================
    const apiId = await create("API checks");
    // Everything already repeating, so each case changes one thing.
    const apiForm = () => {
      const s = seed();
      Object.assign(find(s.blocks, "patients"), { repeats: true, repeatLabel: "patient", minOccurs: 1, maxOccurs: 3 });
      Object.assign(find(s.blocks, "payments"), { repeats: true, repeatLabel: "payment", minOccurs: 0 });
      Object.assign(find(s.blocks, "items"), { repeats: true, repeatLabel: "line item", minOccurs: 1 });
      Object.assign(find(s.blocks, "kids"), { repeats: true, repeatLabel: "child", minOccurs: 0 });
      delete find(s.blocks, "followup").enableWhen;
      find(s.blocks, "cost").enableWhen = [eq("insured", "no")];
      find(s.blocks, "refund").enableWhen = [{ question: "amount", operator: ">", answer: 100 }];
      find(s.blocks, "pnote").enableWhen = [answered("pname")];
      find(s.blocks, "allergy").enableWhen = [{ question: "kage", operator: "<", answer: 5 }];
      // Plain group with leftover settings: stripped.
      Object.assign(find(s.blocks, "household"), { repeats: false, repeatLabel: "home", minOccurs: 2 });
      return s;
    };
    let r = await put(apiId, apiForm());
    check("API: a form with every allowed kind of condition saves (200)", r.status === 200, `${r.status} ${await r.clone().text()}`);
    const apiStored = await stored(apiId);
    check("API: a plain group's leftover settings and repeats: false are not stored",
      JSON.stringify(Object.keys(find(apiStored.blocks, "household"))) === '["id","type","label","blocks"]', JSON.stringify(find(apiStored.blocks, "household")));
    r = await put(apiId, (() => { const s = apiForm(); delete find(s.blocks, "household").repeats; delete find(s.blocks, "household").repeatLabel; delete find(s.blocks, "household").minOccurs; return s; })());
    check("API: repeats off with leftovers vs no settings at all is no change (409 NO_CHANGES)", r.status === 409 && (await r.json()).code === "NO_CHANGES");
    // On, then off again: no change against the saved version.
    r = await put(apiId, (() => { const s = apiForm(); Object.assign(find(s.blocks, "household"), { repeats: true, repeatLabel: "item", minOccurs: 1 }); return s; })());
    check("API: turning Repeats on saves (200)", r.status === 200);
    r = await put(apiId, apiForm());
    check("API: and off again saves (200)", r.status === 200);
    r = await put(apiId, (() => { const s = apiForm(); Object.assign(find(s.blocks, "household"), { repeats: false, repeatLabel: "item", minOccurs: 1 }); return s; })());
    check("API: on-then-off sent again is no change (409 NO_CHANGES)", r.status === 409 && (await r.json()).code === "NO_CHANGES");

    const refusals = [
      ["repeats on a page", (s) => { s.blocks[0].repeats = true; },
        `Page "About you": a page can't repeat — only groups can. Put its questions in a repeating group on the page instead.`],
      ["a blank name for one entry", (s) => { find(s.blocks, "patients").repeatLabel = "  "; },
        `Group "Patients › Patients": a repeating group needs a name for one entry, such as "patient".`],
      ["a missing name, three levels down", (s) => { delete find(s.blocks, "items").repeatLabel; },
        `Group "Patients › Patients › Payments › Line items": a repeating group needs a name for one entry, such as "patient".`],
      ["minOccurs -1", (s) => { find(s.blocks, "kids").minOccurs = -1; },
        `Group "Household › Household › Children": the minimum number of entries must be a whole number, 0 or more.`],
      ["minOccurs 1.5", (s) => { find(s.blocks, "patients").minOccurs = 1.5; },
        `Group "Patients › Patients": the minimum number of entries must be a whole number, 0 or more.`],
      ["maxOccurs 0", (s) => { find(s.blocks, "payments").maxOccurs = 0; },
        `Group "Patients › Patients › Payments": the maximum number of entries must be a whole number, 1 or more, or left blank for at most 1,000.`],
      ["maxOccurs 2.5", (s) => { find(s.blocks, "payments").maxOccurs = 2.5; },
        `Group "Patients › Patients › Payments": the maximum number of entries must be a whole number, 1 or more, or left blank for at most 1,000.`],
      ["maxOccurs below minOccurs", (s) => { Object.assign(find(s.blocks, "patients"), { minOccurs: 3, maxOccurs: 2 }); },
        `Group "Patients › Patients": the maximum number of entries (2) can't be less than the minimum (3).`],
      ["minOccurs above 1,000 with no maximum", (s) => { const g = find(s.blocks, "patients"); g.minOccurs = 1500; delete g.maxOccurs; },
        `Group "Patients › Patients": the minimum number of entries (1500) can't be more than 1,000 without a maximum. Set Maximum entries, or lower the minimum.`],
      ["prefix: a question outside every repeat on a patient's answer", (s) => { find(s.blocks, "followup").enableWhen = [answered("pname")]; },
        PREFIX("Block", "Patients › Follow-up", "Patient name", "Patients", "patient", `Move the block into "Patients", or base the condition on a different question.`)],
      ["prefix: a payment's question on one of its line items", (s) => { find(s.blocks, "refund").enableWhen = [answered("cost")]; },
        PREFIX("Block", "Patients › Patients › Payments › Refund reason", "Cost", "Line items", "line item", `Move the block into "Line items", or base the condition on a different question.`)],
      ["prefix: a repeat on a sibling repeat's question", (s) => { find(s.blocks, "kids").enableWhen = [answered("pname")]; },
        PREFIX("Group", "Household › Household › Children", "Patient name", "Patients", "patient", `Move the group into "Patients", or base the condition on a different question.`)],
      ["prefix: a page on a question inside a repeat", (s) => { s.blocks[2].enableWhen = [answered("amount")]; },
        PREFIX("Page", "Household", "Amount", "Patients", "patient", "Base the condition on a different question.")],
      ["an empty repeating group", (s) => { find(s.blocks, "items").blocks = []; },
        `Group "Patients › Patients › Payments › Line items": a group must contain at least one block.`],
      ["a blank label on a repeating group", (s) => { find(s.blocks, "kids").label = " "; },
        `An unlabelled group inside "Household › Household": a group needs a label.`],
    ];
    const before = await prisma.formVersion.count({ where: { formId: apiId } });
    for (const [name, mutate, expected] of refusals) {
      const s = apiForm(); mutate(s);
      const res = await put(apiId, s);
      const body = await res.json();
      check(`API refuses ${name} (400, naming the block)`, res.status === 400 && body.message === expected, `${res.status} ${body.message}`);
    }
    check("API: no version stored for any refused save", (await prisma.formVersion.count({ where: { formId: apiId } })) === before);
    await remove(apiId);

    // ================= editor =================
    await waitFor(WEB + "/login");
    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1400 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    const card = (id) => P.locator(`[data-block-id="${id}"]`);
    const select = async (id) => { await card(id).locator("span.truncate").first().click(); await P.locator("#block-label").waitFor(); };
    const aside = P.locator("aside");
    const toggle = aside.getByRole("switch", { name: "Repeats" });
    const banner = P.getByRole("alert").filter({ hasText: /^Can't/ });
    const bannerText = () => banner.innerText().catch(() => "");
    const dismiss = async () => { if (await P.getByRole("button", { name: "Dismiss" }).count()) await P.getByRole("button", { name: "Dismiss" }).click(); };
    const badge = async (id) => ((await card(id).locator("[data-repeat-badge]").count()) ? card(id).locator("[data-repeat-badge]").first().textContent() : null);
    const status = () => P.locator("text=/All changes saved|Unsaved changes/").first().textContent();
    const err = (field) => P.locator(`#repeat-${field}-error`);
    const field = (f) => P.locator(`#repeat-${f}`);
    const depth = (id) => card(id).getAttribute("data-depth");
    const timesShown = async (phrase) => (await aside.innerText()).split(phrase).length - 1;
    const pickerValues = () => aside.getByRole("combobox", { name: "Question" }).last().locator("option").evaluateAll((os) => os.map((o) => o.value));
    const HINT = "Some questions aren't listed because they're inside a repeating group this block isn't in.";
    const turnOn = async (id, repeatLabel, min, max) => {
      await select(id);
      await toggle.click();
      if (repeatLabel !== undefined) await field("label").fill(repeatLabel);
      if (min !== undefined) await field("minOccurs").fill(String(min));
      if (max !== undefined) await field("maxOccurs").fill(String(max));
    };
    const addCondition = async (dependent, source, operator, answer) => {
      await select(dependent);
      await aside.getByRole("button", { name: "Add condition" }).click();
      await aside.getByRole("combobox", { name: "Question" }).last().selectOption(source);
      if (operator) await aside.getByRole("combobox", { name: "operator" }).last().selectOption(operator);
      if (answer !== undefined) {
        const box = aside.getByRole("combobox", { name: "Answer" });
        if (await box.count()) await box.last().selectOption(String(answer));
        else await aside.getByRole("spinbutton", { name: "Answer" }).last().fill(String(answer));
      }
    };
    const moveTo = async (id, destination) => {
      await select(id);
      const menu = aside.getByRole("combobox", { name: "Move to", exact: true });
      const labels = await menu.locator("option").allTextContents();
      const label = labels.find((l) => destination.test(l));
      if (!label) throw new Error(`no destination ${destination} in ${labels.join(" | ")}`);
      await menu.selectOption({ label });
      await aside.getByRole("button", { name: "Move", exact: true }).click();
      await sleep(250);
    };
    async function dragTo(id, dx) {
      const from = card(id);
      await from.hover();
      const grip = await from.getByRole("button", { name: "Drag to reorder" }).boundingBox();
      const sx = grip.x + grip.width / 2, sy = grip.y + grip.height / 2;
      await P.mouse.move(sx, sy);
      await P.mouse.down();
      await P.mouse.move(sx + 8, sy + 2, { steps: 3 });
      await P.mouse.move(sx + dx, sy, { steps: 20 });
      await sleep(200);
      await P.mouse.up();
      await sleep(400);
    }

    const formId = await create("Clinic visit");
    r = await put(formId, seed());
    check("editor: seed form (plain groups, three pages) saves", r.status === 200, await r.clone().text());
    await P.goto(`${WEB}/app/forms/${formId}/edit`);
    await P.getByText("All changes saved").waitFor({ timeout: 60000 });

    // ---------- the toggle: groups only ----------
    await card("p1").locator("span", { hasText: /^Page \d+$/ }).click();
    check("a page has no Repeats switch", (await P.locator("aside h2").first().textContent()) === "Page" && (await toggle.count()) === 0);
    await select("household");
    check("a group has a Repeats switch, off, with no repeat fields", (await toggle.count()) === 1 && (await toggle.getAttribute("aria-checked")) === "false" && (await field("label").count()) === 0);

    // ---------- turning on is refused while something outside uses a question inside ----------
    await select("patients");
    await toggle.click();
    check("guard: turning on Repeats is refused while Follow-up uses a patient's name",
      (await bannerText()).startsWith(`Can't make "Patients" repeat — these blocks outside it have conditions that use a question inside it:`)
      && (await banner.getByRole("button", { name: "Follow-up →" }).count()) === 1 && (await toggle.getAttribute("aria-checked")) === "false", await bannerText());
    await P.screenshot({ path: `${OUT}/repeats-1-turn-on-refused.png` });
    await banner.getByRole("button", { name: "Follow-up →" }).click();
    await sleep(300);
    check("guard: the jump link selects Follow-up", (await P.locator("#block-label").inputValue()) === "Follow-up");
    await dismiss();
    await aside.getByRole("button", { name: "Remove condition" }).click();

    // ---------- Patients: 1–3 ----------
    await select("patients");
    await toggle.click();
    check("turning on writes the defaults: item, 1, no maximum", (await toggle.getAttribute("aria-checked")) === "true"
      && (await field("label").inputValue()) === "item" && (await field("minOccurs").inputValue()) === "1" && (await field("maxOccurs").inputValue()) === "");
    check("the default preview", (await P.locator("#repeat-label-preview").textContent()) === "Item 1 · Add another item · Remove item 1");
    check("badge: Repeats · 1 or more", (await badge("patients")) === "Repeats · 1 or more", await badge("patients"));
    check("help texts", await aside.getByText("Write it as it would appear mid-sentence").isVisible()
      && await aside.getByText("0 lets the respondent remove every entry.").isVisible() && await aside.getByText("Leave blank for at most 1,000.").isVisible()
      && (await field("maxOccurs").getAttribute("placeholder")) === "1,000");
    check("fields are labelled", (await aside.getByLabel("Name for one entry").count()) === 1 && (await aside.getByLabel("Minimum entries").count()) === 1 && (await aside.getByLabel("Maximum entries").count()) === 1);

    // Inline errors, each under its field and shown once (not again in the Logic section).
    await field("label").fill(" ");
    check("inline: blank name", (await err("label").textContent()) === 'A repeating group needs a name for one entry, such as "patient".'
      && (await field("label").getAttribute("aria-invalid")) === "true" && (await P.locator("#repeat-label-preview").count()) === 0);
    check("inline: the blank-name message is shown once", (await timesShown("needs a name for one entry")) === 1);
    await field("label").fill("patient");
    check("preview follows the name", (await P.locator("#repeat-label-preview").textContent()) === "Patient 1 · Add another patient · Remove patient 1");
    for (const [value, expected] of [["-1", "The minimum number of entries must be a whole number, 0 or more."], ["1.5", "The minimum number of entries must be a whole number, 0 or more."]]) {
      await field("minOccurs").fill(value);
      check(`inline: minimum ${value}`, (await err("minOccurs").textContent()) === expected && (await field("minOccurs").getAttribute("aria-invalid")) === "true");
    }
    await field("minOccurs").fill("1");
    await field("maxOccurs").fill("0");
    check("inline: maximum 0", (await err("maxOccurs").textContent()) === "The maximum number of entries must be a whole number, 1 or more, or left blank for at most 1,000.");
    await field("maxOccurs").fill("");
    await field("minOccurs").fill("1500");
    check("inline: a minimum above 1,000 with no maximum", (await err("minOccurs").textContent()) === "The minimum number of entries (1500) can't be more than 1,000 without a maximum. Set Maximum entries, or lower the minimum.");
    await field("minOccurs").fill("3");
    await field("maxOccurs").fill("2");
    check("inline: maximum below minimum", (await err("maxOccurs").textContent()) === "The maximum number of entries (2) can't be less than the minimum (3).");
    check("inline: shown once, nothing in the Logic section", (await timesShown("can't be less than the minimum")) === 1);
    await field("maxOccurs").fill("3");
    check("badge: Repeats · exactly 3", (await badge("patients")) === "Repeats · exactly 3");
    await field("minOccurs").fill("1");
    check("inline errors clear when fixed", (await err("minOccurs").count()) + (await err("maxOccurs").count()) + (await err("label").count()) === 0);
    check("badge: Repeats · 1–3", (await badge("patients")) === "Repeats · 1–3", await badge("patients"));

    // The rest, from the keyboard for one of them.
    await turnOn("payments", "payment", 0);
    check("badge: Repeats · 0 or more", (await badge("payments")) === "Repeats · 0 or more", await badge("payments"));
    await select("items");
    await toggle.focus();
    await P.keyboard.press("Space");
    check("Space turns Repeats on from the keyboard", (await toggle.getAttribute("aria-checked")) === "true");
    await field("label").fill("line item");
    check("preview keeps the name's case after the first letter", (await P.locator("#repeat-label-preview").textContent()) === "Line item 1 · Add another line item · Remove line item 1");
    check("badge: Repeats · 1 or more (three levels down)", (await badge("items")) === "Repeats · 1 or more");
    await turnOn("kids", "child", 0);
    check("a conditional repeat inside a plain group", (await badge("kids")) === "Repeats · 0 or more" && (await badge("household")) === null
      && (await card("kids").getByText("Conditional").count()) === 1);
    const n = async (id) => card(id).locator("span.tabular-nums").textContent();
    const numbers = [];
    for (const id of ["consent", "hasKids", "pname", "insured", "amount", "desc", "cost", "refund", "pnote", "followup", "address", "kname", "kage", "allergy", "final"]) numbers.push(await n(id));
    check("numbering: questions in repeats are numbered once, in template order", numbers.join(" ") === "1. 2. 3. 4. 5. 6. 7. 8. 9. 10. 11. 12. 13. 14. 15.", numbers.join(" "));

    // ---------- the source picker ----------
    await select("followup");
    await aside.getByRole("button", { name: "Add condition" }).click();
    let values = await pickerValues();
    check("picker: outside every repeat, only questions outside repeats are offered",
      JSON.stringify(values) === JSON.stringify(["consent", "hasKids"]), JSON.stringify(values));
    check("picker: the note explains the missing questions", (await aside.getByText(HINT).count()) === 1);
    await aside.getByRole("button", { name: "Remove condition" }).click();
    await addCondition("cost", "insured", "=", "No"); // an enclosing instance, two levels out
    values = await pickerValues();
    check("picker: a line item is offered its own, its payment's, its patient's and outside questions",
      ["consent", "hasKids", "pname", "insured", "amount", "desc"].every((v) => values.includes(v)) && (await aside.getByText(HINT).count()) === 0, JSON.stringify(values));
    await addCondition("refund", "amount", ">", 100); // same instance
    values = await pickerValues();
    check("picker: a payment's question isn't offered its line items' questions",
      values.includes("amount") && values.includes("pname") && !values.includes("desc") && !values.includes("cost") && (await aside.getByText(HINT).count()) === 1, JSON.stringify(values));
    await addCondition("pnote", "pname"); // same instance, "is answered"
    await addCondition("allergy", "kage", "<", 5);
    values = await pickerValues();
    check("picker: a child's question isn't offered any patient's question",
      ["consent", "hasKids", "address", "kname", "kage", "followup"].every((v) => values.includes(v)) && !["pname", "insured", "amount", "desc", "cost", "refund", "pnote"].some((v) => values.includes(v)), JSON.stringify(values));
    await select("final");
    await aside.getByRole("button", { name: "Add condition" }).click();
    values = await pickerValues();
    check("picker: a later page's question isn't offered questions inside repeats",
      !["pname", "kname", "kage", "allergy"].some((v) => values.includes(v)) && values.includes("address"), JSON.stringify(values));
    await aside.getByRole("button", { name: "Remove condition" }).last().click();
    await select("cost");
    check("no Logic problems shown on a dependent two repeats in", (await aside.locator("[data-field-error]").count()) === 0);

    // ---------- move guards ----------
    const before2 = JSON.stringify([await depth("pnote"), await depth("hasKids"), await depth("allergy")]);
    await moveTo("pnote", /Children$/);
    check("guard: moving a dependent between repeats (patient → child) is refused",
      (await bannerText()).startsWith(`Can't move "Notes about this patient" there — these blocks would have conditions on a question inside a repeating group they aren't in:`)
      && (await banner.getByRole("button", { name: "Notes about this patient →" }).count()) === 1, await bannerText());
    await dismiss();
    await moveTo("pnote", /^Household$/);
    check("guard: moving a dependent out of its source's repeat is refused", (await bannerText()).startsWith(`Can't move "Notes about this patient" there — these blocks would have conditions on a question inside a repeating group they aren't in:`), await bannerText());
    await dismiss();
    await moveTo("hasKids", /› Patients$/);
    check("guard: moving a source into a repeat that doesn't hold its dependent is refused, naming it",
      (await bannerText()).startsWith(`Can't move "Do you have children?" there — these blocks would have conditions on a question inside a repeating group they aren't in:`)
      && (await banner.getByRole("button", { name: "Children →" }).count()) === 1, await bannerText());
    await banner.getByRole("button", { name: "Children →" }).click();
    await sleep(300);
    check("guard: the jump link selects the dependent repeat", (await P.locator("#block-label").inputValue()) === "Children");
    await dismiss();
    await select("pnote");
    await aside.getByRole("button", { name: "Move down" }).click();
    await sleep(250);
    check("guard: the Move down button out of the repeat is refused", (await bannerText()).startsWith(`Can't move "Notes about this patient" there — these blocks would have conditions on a question inside a repeating group they aren't in:`), await bannerText());
    await dismiss();
    await P.locator('input[placeholder="Add a description…"]').click();
    await dragTo("pnote", -40);
    check("guard: dragging a dependent out of its source's repeat is refused", (await bannerText()).startsWith(`Can't move "Notes about this patient" there — these blocks would have conditions on a question inside a repeating group they aren't in:`), await bannerText());
    await dismiss();
    check("refused moves changed nothing", JSON.stringify([await depth("pnote"), await depth("hasKids"), await depth("allergy")]) === before2);
    await moveTo("pnote", /› Payments$/);
    check("a move deeper into the source's repeat is allowed", (await banner.count()) === 0 && (await depth("pnote")) === "3");
    await moveTo("pnote", /› Patients$/);
    check("and back", (await banner.count()) === 0 && (await depth("pnote")) === "2");

    // ---------- save, then on-then-off is no change ----------
    await P.locator('input[placeholder="Add a description…"]').click();
    await P.screenshot({ path: `${OUT}/repeats-2-canvas.png` });
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await P.getByText("All changes saved").waitFor({ timeout: 10000 });
    await select("payments");
    await toggle.click();
    check("turning Repeats off is always allowed, and clears the fields", (await toggle.getAttribute("aria-checked")) === "false" && (await field("label").count()) === 0 && (await badge("payments")) === null);
    check("off: the form is changed", /Unsaved changes/.test(await status()));
    await toggle.click();
    check("on again: the defaults, not the old values", (await field("label").inputValue()) === "item" && (await field("minOccurs").inputValue()) === "1");
    await field("label").fill("payment");
    await field("minOccurs").fill("0");
    check("on-then-off with the saved values typed back: no unsaved changes", /All changes saved/.test(await status()), await status());

    // ---------- the artifact ----------
    const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    const art = JSON.parse(raw);
    check("artifact: schemaVersion still 2", art.schemaVersion === 2);
    const keys = (id) => Object.keys(find(art.blocks, id)).join(",");
    check("artifact: Patients", JSON.stringify(find(art.blocks, "patients"), ["repeats", "repeatLabel", "minOccurs", "maxOccurs"]) === '{"repeats":true,"repeatLabel":"patient","minOccurs":1,"maxOccurs":3}'
      && keys("patients") === "id,type,label,repeats,repeatLabel,minOccurs,maxOccurs,blocks", keys("patients"));
    check("artifact: Payments (no maximum)", JSON.stringify(find(art.blocks, "payments"), ["repeats", "repeatLabel", "minOccurs", "maxOccurs"]) === '{"repeats":true,"repeatLabel":"payment","minOccurs":0}');
    check("artifact: Line items", JSON.stringify(find(art.blocks, "items"), ["repeats", "repeatLabel", "minOccurs", "maxOccurs"]) === '{"repeats":true,"repeatLabel":"line item","minOccurs":1}');
    check("artifact: Children, with its condition", JSON.stringify(find(art.blocks, "kids"), ["repeats", "repeatLabel", "minOccurs", "maxOccurs", "enableWhen", "question", "operator", "answer"])
      === '{"repeats":true,"repeatLabel":"child","minOccurs":0,"enableWhen":[{"question":"hasKids","operator":"=","answer":"yes"}]}', keys("kids"));
    check("artifact: no repeat settings on the plain group or on pages", keys("household") === "id,type,label,blocks"
      && art.blocks.every((p) => !Object.keys(p).some((k) => /^(repeats|repeatLabel|minOccurs|maxOccurs)$/.test(k))));
    check("artifact: the conditions, of every allowed kind",
      JSON.stringify(noIds(find(art.blocks, "cost").enableWhen)) === JSON.stringify([eq("insured", "no")])
      && JSON.stringify(noIds(find(art.blocks, "refund").enableWhen)) === JSON.stringify([{ question: "amount", operator: ">", answer: 100 }])
      && JSON.stringify(noIds(find(art.blocks, "pnote").enableWhen)) === JSON.stringify([answered("pname")])
      && JSON.stringify(noIds(find(art.blocks, "allergy").enableWhen)) === JSON.stringify([{ question: "kage", operator: "<", answer: 5 }])
      && JSON.stringify(noIds(find(art.blocks, "desc").enableWhen)) === JSON.stringify([eq("consent", "yes")])
      && !find(art.blocks, "followup").enableWhen);
    saveArtifact(ARTIFACT, raw);
    await remove(formId);

    // ================= render (optional) =================
    if (!EXTERNAL_APP) {
      console.log("  SKIP  render in the external test app (set E2E_EXTERNAL_APP_URL and E2E_EXTERNAL_FORMS_DIR to run it)");
    } else if (!process.env.E2E_EXTERNAL_FORMS_DIR || !fs.existsSync(path.join(process.env.E2E_EXTERNAL_FORMS_DIR, ARTIFACT))) {
      check("render: E2E_EXTERNAL_FORMS_DIR is set, so the app has this run's artifact", false, "set E2E_EXTERNAL_FORMS_DIR to the test app's src/forms");
    } else {
      // The steps below find repeats, their entries and Add by the renderer's zf- class names.
      const version = rendererVersion();
      check(`render: the test app has @zoworkhq/forms ${ZF_RENDERER} or later (zf- names)`, atLeast(version, ZF_RENDERER), version);
      await sleep(1500); // let the app's dev server see the new file
      const R = await ctx.newPage();
      R.on("pageerror", (e) => check("render: no page errors", false, e.message));
      const dialogs = [];
      R.on("dialog", (d) => { dialogs.push(d.message()); d.accept(); });
      await R.goto(`${EXTERNAL_APP}${EXTERNAL_APP.includes("?") ? "&" : "?"}form=builder-repeats`);
      const next = () => R.getByRole("button", { name: "Next", exact: true }).click();
      const choose = (scope, question, option) => scope.getByRole("group", { name: question, exact: true }).getByRole("radio", { name: option, exact: true }).check();
      const repeatOf = (legend) => R.locator("fieldset.zf-repeat").filter({ has: R.locator(":scope > legend", { hasText: legend }) }).first();
      const instance = (name) => R.getByRole("group", { name, exact: true });

      await choose(R, "Do you agree to share details?", "Yes");
      await choose(R, "Do you have children?", "No");
      await next();
      await instance("Patient 1").waitFor({ timeout: 15000 });
      check("render: Patients starts with one patient (minOccurs 1), Payments with none (minOccurs 0)",
        (await repeatOf("Patients").locator(":scope > fieldset.zf-repeat-instance").count()) === 1
        && (await instance("Patient 1").getByRole("button", { name: /^Add payment to patient \d$/ }).count()) === 1);
      const p1 = instance("Patient 1");
      await p1.getByLabel("Patient name").fill("Ann");
      await choose(p1, "Is this patient insured?", "No");
      await p1.getByRole("button", { name: /^Add payment to patient \d$/ }).click();
      const pay = p1.getByRole("group", { name: "Payment 1", exact: true });
      await pay.getByLabel("Amount").fill("50");
      const item = pay.getByRole("group", { name: "Line item 1", exact: true });
      check("render: a line item shows a question on its patient's answer (two levels out) and one on an answer outside every repeat",
        await item.getByLabel("Cost").isVisible() && await item.getByLabel("Description").isVisible());
      await item.getByLabel("Description").fill("Consultation");
      await item.getByLabel("Cost").fill("50");
      check("render: a same-instance condition: Notes shown once the name is answered", await p1.getByLabel("Notes about this patient").isVisible());

      await repeatOf("Patients").locator(":scope > .zf-repeat-add").click();
      const p2 = instance("Patient 2");
      await p2.getByLabel("Patient name").fill("Bob");
      await choose(p2, "Is this patient insured?", "Yes");
      await p2.getByRole("button", { name: /^Add payment to patient \d$/ }).click();
      const pay2 = p2.getByRole("group", { name: "Payment 1", exact: true });
      await pay2.getByLabel("Amount").fill("150");
      await pay2.getByRole("group", { name: "Line item 1", exact: true }).getByLabel("Description").fill("Scan");
      check("render: per instance — Cost hidden for an insured patient, Refund reason shown for an amount over 100",
        (await pay2.getByLabel("Cost").count()) === 0 && await pay2.getByLabel("Refund reason").isVisible() && (await pay.getByLabel("Refund reason").count()) === 0);
      await pay2.getByLabel("Refund reason").fill("Overcharged");

      await repeatOf("Patients").locator(":scope > .zf-repeat-add").click();
      check("render: at maxOccurs 3 Add is disabled with its limit text", await repeatOf("Patients").locator(":scope > .zf-repeat-add").isDisabled()
        && await repeatOf("Patients").getByText("You can add up to 3.", { exact: true }).first().isVisible());
      await instance("Patient 3").getByLabel("Patient name").fill("Temp");
      await instance("Patient 3").getByRole("button", { name: /^Remove patient 3$/ }).click();
      check("render: removing an instance with answers asks first", dialogs.includes("Remove patient 3? Its answers will be deleted."), dialogs.join(" | "));
      check("render: two patients left, Add enabled again", (await repeatOf("Patients").locator(":scope > fieldset.zf-repeat-instance").count()) === 2
        && !(await repeatOf("Patients").locator(":scope > .zf-repeat-add").isDisabled()));
      await R.screenshot({ path: `${OUT}/repeats-3-render-patients.png`, fullPage: true });
      await next();

      await R.getByLabel("Address").waitFor();
      check("render: the conditional repeat is hidden while its condition fails", (await R.locator("fieldset.zf-repeat").count()) === 0);
      await R.getByRole("button", { name: "Back", exact: true }).click();
      await R.getByRole("button", { name: "Back", exact: true }).click();
      await choose(R, "Do you have children?", "Yes");
      await next(); await next();
      await R.getByLabel("Address").fill("1 High St");
      const kids = repeatOf("Children");
      check("render: shown when it passes, inside its plain group, starting empty (minOccurs 0)",
        await kids.isVisible() && (await kids.locator(":scope > fieldset.zf-repeat-instance").count()) === 0
        && (await R.locator("fieldset.zf-group:not(.zf-repeat)").filter({ has: kids }).count()) >= 1);
      await kids.getByRole("button", { name: "Add child", exact: true }).click();
      const child = instance("Child 1");
      await child.getByLabel("Child's name").fill("Cy");
      await child.getByLabel("Child's age").fill("3");
      await child.getByLabel("Allergies").fill("Peanuts");
      await R.getByLabel("Anything else?").fill("No");

      const [req] = await Promise.all([
        R.waitForRequest((x) => /\/api\/submit$/.test(new URL(x.url()).pathname) && x.method() === "POST", { timeout: 15000 }),
        R.getByRole("button", { name: "Submit", exact: true }).click(),
      ]);
      const res = await req.response();
      await R.getByText("Form submitted successfully.").waitFor({ timeout: 15000 }).catch(() => {});
      check("render: the submit is accepted", res && res.ok() && await R.getByText("Form submitted successfully.").isVisible(), res ? String(res.status()) : "no response");
      const answers = JSON.parse(req.postData()).answers;
      const v = (x) => x && x.value;
      const [ann, bob] = answers.patients ?? [];
      check("payload: two patients, in order, as an array", Array.isArray(answers.patients) && answers.patients.length === 2 && v(ann.pname) === "Ann" && v(bob.pname) === "Bob", JSON.stringify(answers.patients));
      check("payload: nested payments and line items as arrays", Array.isArray(ann.payments) && ann.payments.length === 1 && Array.isArray(ann.payments[0].items)
        && v(ann.payments[0].amount) === 50 && v(ann.payments[0].items[0].cost) === 50 && v(ann.payments[0].items[0].desc) === "Consultation", JSON.stringify(ann));
      check("payload: hidden questions left out per instance", !("cost" in bob.payments[0].items[0]) && v(bob.payments[0].refund) === "Overcharged" && !("refund" in ann.payments[0]), JSON.stringify(bob));
      check("payload: the children, and nothing for groups or instance ids", Array.isArray(answers.kids) && answers.kids.length === 1 && v(answers.kids[0].allergy) === "Peanuts"
        && !("household" in answers) && !JSON.stringify(answers).includes('"id"'), JSON.stringify(answers.kids));
      check("payload: questions outside repeats stay flat at the root", v(answers.consent) === "yes" && v(answers.final) === "No" && v(answers.address) === "1 High St");
      fs.writeFileSync(path.join(OUT, "repeats-submitted-payload.json"), req.postData());
      await R.close();
    }
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { for (const p of browser?.contexts()[0]?.pages() ?? []) await p.screenshot({ path: `${OUT}/repeats-failure-${p === browser.contexts()[0].pages()[0] ? "editor" : "render"}.png` }); } catch {}
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
