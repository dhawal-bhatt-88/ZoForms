// Templates through the real UI: save a group with an outside condition as a template (the
// confirmation, the condition gone from the template, the form unchanged); insert it twice as
// a group, and as a page in a paged form and in an empty one; "Insert as page" unavailable in a
// form without pages; edit an organisation template, leaving forms alone; duplicate a system
// template and edit the copy; no edit controls on system templates; a form from a form
// template; no templateRef in a download; another organisation sees none of these templates;
// a viewer sees no write actions. With E2E_EXTERNAL_APP_URL set, the form with the template
// inserted twice is rendered in the external test app, and both copies' conditions are checked.
const fs = require("fs");
const path = require("path");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact, opts } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXTERNAL_APP = process.env.E2E_EXTERNAL_APP_URL;
const ARTIFACT = "builder-templates-schema.json";

const q = (id, type, label, extra = {}) => ({ id, type, label, required: false, ...extra });
const when = (question, operator, answer) => ({ question, operator, ...(answer === undefined ? {} : { answer }) });
const latest = async (formId) => (await prisma.formVersion.findFirst({ where: { formId }, orderBy: { version: "desc" } })).schema;
const walk = (blocks, out = []) => {
  for (const b of blocks) {
    out.push(b);
    if (b.blocks) walk(b.blocks, out);
  }
  return out;
};

/** The form a group is saved from: the group depends on a question before it, at three depths. */
const HEALTH = {
  title: "Health check",
  blocks: [
    q("b_age00001", "number", "Age"),
    q("b_smoke001", "choice", "Do you smoke?", { options: opts("Yes", "No") }),
    { id: "b_group001", type: "group", label: "Smoking details", enableWhen: [when("b_smoke001", "=", "yes")], blocks: [
      q("b_cigs0001", "number", "Cigarettes a day", { enableWhen: [when("b_smoke001", "=", "yes")] }),
      q("b_quit0001", "choice", "Ever tried to quit?", { options: opts("Yes", "No") }),
      q("b_times001", "number", "How many times?", {
        enableWhen: [when("b_quit0001", "=", "yes"), when("b_age00001", ">=", 18), when("b_cigs0001", ">", 10)],
        enableLogicText: "1 AND (2 OR 3)",
      }),
    ] },
  ],
};

(async () => {
  const tag = Date.now();
  const emails = [];
  let browser;
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }
    const json = { "Content-Type": "application/json" };
    const signup = async (who) => {
      const email = `verify-templates-${who}-${tag}@example.test`;
      emails.push(email);
      const r = await (await fetch(API + "/v1/auth/signup", { method: "POST", headers: json, body: JSON.stringify({ email, password: "Verify-pass-123!", name: who }) })).json();
      if (!r.token) throw new Error(`signup ${who}: ${JSON.stringify(r)}`);
      return r.token;
    };
    const A = await signup("author");
    const B = await signup("other");
    const auth = (t) => ({ ...json, Authorization: `Bearer ${t}` });
    const createForm = async (t, title, content) => {
      const f = await (await fetch(API + "/v1/forms", { method: "POST", headers: auth(t), body: JSON.stringify({ title }) })).json();
      if (content) {
        const r = await fetch(`${API}/v1/forms/${f.id}/schema`, { method: "PUT", headers: auth(t), body: JSON.stringify(content) });
        if (!r.ok) throw new Error(`fixture ${title}: ${await r.text()}`);
      }
      return f.id;
    };
    // A viewer in the author's organisation, through the real invite.
    const viewerEmail = `verify-templates-viewer-${tag}@example.test`;
    emails.push(viewerEmail);
    const invite = await (await fetch(API + "/v1/team/invites", { method: "POST", headers: auth(A), body: JSON.stringify({ email: viewerEmail, role: "VIEWER" }) })).json();
    const accepted = await (await fetch(`${API}/v1/invites/${invite.invite.token}/accept`, { method: "POST", headers: json, body: JSON.stringify({ password: "Verify-pass-123!", name: "Viewer" }) })).json();
    const V = accepted.token;
    check("setup: a viewer in the author's organisation", !!V && (await (await fetch(API + "/v1/auth/me", { headers: auth(V) })).json()).role === "VIEWER");

    const healthId = await createForm(A, "Health check", HEALTH);
    const hostId = await createForm(A, "Host", { title: "Host", blocks: [q("b_name0001", "short", "Your name")] });
    const pagedId = await createForm(A, "Paged", { title: "Paged", blocks: [{ id: "b_page0001", type: "page", title: "Start", blocks: [q("b_first001", "short", "First")] }] });
    const emptyId = await createForm(A, "Empty");
    const otherFormId = await createForm(B, "Theirs", { title: "Theirs", blocks: [q("b_their001", "short", "Theirs")] });

    browser = await launchBrowser();
    const contextFor = async (token) => {
      const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
      await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
      await ctx.addInitScript(() => {
        const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
        if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
      });
      return ctx;
    };
    const ctx = await contextFor(A);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("no page errors", false, e.message));
    const card = (id) => page.locator(`[data-block-id="${id}"]`);
    const save = async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText("All changes saved").waitFor();
    };
    const download = async () => {
      const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
      return fs.readFileSync(await dl.path(), "utf8");
    };
    const openPicker = async () => {
      await page.getByTitle("Insert a block").click();
      await page.getByPlaceholder("Search blocks…").fill("from template");
      await page.keyboard.press("Enter");
      const picker = page.getByRole("dialog", { name: "Insert from a template" });
      await picker.waitFor();
      return picker;
    };

    // ================= save a group with an outside condition as a template =================
    await page.goto(`${WEB}/app/forms/${healthId}/edit`);
    await page.getByText("All changes saved").waitFor();
    const versionsBefore = await prisma.formVersion.count({ where: { formId: healthId } });
    const healthBefore = JSON.stringify(await latest(healthId));
    await card("b_group001").hover();
    await page.getByRole("button", { name: 'More actions for group "Smoking details"' }).click();
    await page.getByRole("menuitem", { name: "Save as template…" }).click();
    const saveDialog = page.getByRole("dialog", { name: "Save group as template" });
    await saveDialog.waitFor();
    check("save as template: the name is the group's label", (await saveDialog.getByLabel("Template name").inputValue()) === "Smoking details");
    const removed = await saveDialog.locator("[data-removed-conditions] li").allInnerTexts();
    check("confirmation: each outside condition, in the brief's wording", JSON.stringify(removed) === JSON.stringify([
      `"Smoking details" — condition 1 ("Do you smoke?" is Yes) refers to a question outside this group and won't be included.`,
      `"Cigarettes a day" — condition 1 ("Do you smoke?" is Yes) refers to a question outside this group and won't be included.`,
      `"How many times?" — condition 2 ("Age" is at least 18) refers to a question outside this group and won't be included.`,
    ]), JSON.stringify(removed));
    const rewritten = await saveDialog.locator("[data-rewritten-logic] li").allInnerTexts();
    check("confirmation: the logic regenerated from what is left", JSON.stringify(rewritten) === JSON.stringify([`"How many times?" — its logic "1 AND (2 OR 3)" becomes "1 AND 2".`]), JSON.stringify(rewritten));
    await saveDialog.getByLabel("Description (optional)").fill("Smoking history, with quit attempts");
    await saveDialog.getByRole("button", { name: "Save without them" }).click();
    await saveDialog.waitFor({ state: "detached" });
    await page.getByText(`Saved "Smoking details" to your organisation's templates.`).waitFor();
    check("focus returns to the group's ⋯ button", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")) === 'More actions for group "Smoking details"');
    const tpl = await prisma.template.findFirst({ where: { name: "Smoking details", orgId: { not: null } } });
    const tplBlocks = walk([tpl.content]);
    const byId = (id) => tplBlocks.find((b) => b.id === id);
    check("template: the outside conditions are gone, at every depth", !tpl.content.enableWhen && !byId("b_cigs0001").enableWhen &&
      JSON.stringify(byId("b_times001").enableWhen.map((c) => [c.question, c.operator, c.answer])) === JSON.stringify([["b_quit0001", "=", "yes"], ["b_cigs0001", ">", 10]]),
      JSON.stringify(tpl.content));
    check("template: the logic text is the regenerated one", byId("b_times001").enableLogicText === "1 AND 2");
    check("template: a group template, with its description", tpl.kind === "group" && tpl.description === "Smoking history, with quit attempts");
    check("the form itself is unchanged (no new version, same content)",
      (await prisma.formVersion.count({ where: { formId: healthId } })) === versionsBefore && JSON.stringify(await latest(healthId)) === healthBefore);

    // ================= "Insert as page" isn't available in a form without pages =================
    let picker = await openPicker();
    await picker.getByRole("button", { name: /Smoking details/ }).click();
    await picker.getByText("Cigarettes a day").first().waitFor();
    check("a form without pages, with content: Insert as page is unavailable, with the reason",
      await picker.getByRole("button", { name: "Insert as page" }).isDisabled() &&
      (await picker.getByText("This form has no pages. Add a page first or insert as a group.", { exact: true }).count()) === 1);
    check("…and the reason describes the button", (await picker.getByRole("button", { name: "Insert as page" }).getAttribute("aria-describedby")) !== null);
    await picker.getByRole("button", { name: "Cancel" }).click();
    await picker.waitFor({ state: "detached" });

    // ================= insert it twice as a group =================
    await page.goto(`${WEB}/app/forms/${hostId}/edit`);
    await page.getByText("All changes saved").waitFor();
    for (let n = 0; n < 2; n++) {
      // The question selected: each copy goes in after it, at the top level (with a group
      // selected, as after an insert, the next block would go inside that group).
      await card("b_name0001").click();
      picker = await openPicker();
      await picker.getByRole("button", { name: /Smoking details/ }).click();
      await picker.getByText("Cigarettes a day").first().waitFor();
      await picker.getByRole("button", { name: "Insert as group" }).click();
      await picker.waitFor({ state: "detached" });
    }
    check("inserted twice: two group boxes on the canvas", (await page.locator("[data-group-box]").count()) === 2);
    await save();
    const host = await latest(hostId);
    const copies = host.blocks.filter((b) => b.type === "group");
    const idsOf = (g) => walk([g]).map((b) => b.id);
    const [one, two] = copies.map(idsOf);
    check("inserted twice: two copies, each with templateRef", copies.length === 2 && copies.every((g) => g.templateRef?.id === tpl.id && g.templateRef.version === 1 && g.templateRef.name === "Smoking details"));
    check("…fresh ids, none shared with each other or the template", one.every((id) => !two.includes(id) && !tplBlocks.some((b) => b.id === id)));
    const timesOf = (g) => walk([g]).find((b) => b.label === "How many times?");
    check("…each copy's conditions use its own questions; condition ids and logic text kept",
      copies.every((g) => timesOf(g).enableWhen.every((c) => idsOf(g).includes(c.question)) && timesOf(g).enableLogicText === "1 AND 2" &&
        JSON.stringify(timesOf(g).enableWhen.map((c) => c.id)) === JSON.stringify(byId("b_times001").enableWhen.map((c) => c.id))));
    const hostRaw = await download();
    check("the download has no templateRef", !hostRaw.includes("templateRef") && JSON.parse(hostRaw).blocks.length === 3);
    saveArtifact(ARTIFACT, hostRaw);

    // ================= insert as a page: in a paged form, and in an empty one =================
    await page.goto(`${WEB}/app/forms/${pagedId}/edit`);
    await page.getByText("All changes saved").waitFor();
    picker = await openPicker();
    await picker.getByRole("button", { name: /Smoking details/ }).click();
    await picker.getByText("Cigarettes a day").first().waitFor();
    check("a paged form: Insert as page is available", await picker.getByRole("button", { name: "Insert as page" }).isEnabled());
    await picker.getByRole("button", { name: "Insert as page" }).click();
    await picker.waitFor({ state: "detached" });
    check("…a new page on the canvas, titled with the group's label", (await page.getByRole("textbox", { name: "Page 2 title" }).inputValue()) === "Smoking details");
    await save();
    const paged = await latest(pagedId);
    check("…saved: page 2 holds the group, with templateRef", paged.blocks.length === 2 && paged.blocks[1].type === "page" && paged.blocks[1].title === "Smoking details" &&
      paged.blocks[1].blocks.length === 1 && paged.blocks[1].blocks[0].templateRef?.id === tpl.id, JSON.stringify(paged.blocks.map((b) => [b.type, b.title])));

    await page.goto(`${WEB}/app/forms/${emptyId}/edit`);
    await page.getByText("All changes saved").waitFor();
    picker = await openPicker();
    await picker.getByRole("button", { name: /Smoking details/ }).click();
    await picker.getByText("Cigarettes a day").first().waitFor();
    await picker.getByRole("button", { name: "Insert as page" }).click();
    await picker.waitFor({ state: "detached" });
    await save();
    const empty = await latest(emptyId);
    check("an empty form: Insert as page makes it a paged form with that page", empty.blocks.length === 1 && empty.blocks[0].type === "page" && empty.blocks[0].blocks[0].type === "group");

    // ================= edit an organisation template; forms keep their copies =================
    const hostBefore = JSON.stringify(await latest(hostId));
    await page.goto(`${WEB}/app/templates`);
    await page.getByRole("tab", { name: /Your organisation/ }).click();
    await page.getByRole("link", { name: 'Edit "Smoking details"' }).click();
    await page.getByRole("heading", { name: "Template: Smoking details" }).waitFor();
    check("template mode: no Download or Ask AI", (await page.getByRole("button", { name: /Download|Ask AI/ }).count()) === 0);
    check("template mode: the group can't gain siblings (no Add page)", (await page.getByRole("button", { name: /^Add page/ }).count()) === 0);
    await card("b_quit0001").click();
    await page.locator("#block-label").fill("Have you tried to quit?");
    await save();
    const tplAfter = await prisma.template.findUnique({ where: { id: tpl.id } });
    check("editing the template: saved, version 2", tplAfter.version === 2 && walk([tplAfter.content]).some((b) => b.label === "Have you tried to quit?"));
    check("…forms it was inserted into are unchanged", JSON.stringify(await latest(hostId)) === hostBefore);

    // ================= duplicate a system template and edit the copy =================
    const system = await prisma.template.findUnique({ where: { id: "sys_form_bug" } });
    await page.goto(`${WEB}/app/templates`);
    const bugCard = page.locator(`li[data-template-id="sys_form_bug"]`);
    await bugCard.waitFor();
    check("system templates: no Edit, Rename or Delete controls", (await bugCard.getByRole("link", { name: /^Edit / }).count()) === 0 &&
      (await bugCard.getByRole("button", { name: /More actions/ }).count()) === 0);
    await bugCard.getByRole("button", { name: 'Preview "Bug Report"' }).click();
    const preview = page.getByRole("dialog", { name: "Bug Report" });
    await preview.getByText("Steps to reproduce").waitFor();
    check("system template preview: no Edit", (await preview.getByRole("link", { name: /Edit/ }).count()) === 0);
    await preview.getByRole("button", { name: "Close", exact: true }).last().click(); // the footer button; the × is named Close too
    await bugCard.getByRole("button", { name: 'Duplicate "Bug Report" to my templates' }).click();
    await page.getByText(`Copied to your organisation's templates as "Copy of Bug Report".`).waitFor();
    check("duplicate: the organisation tab shows the copy", await page.getByRole("tab", { name: /Your organisation/ }).getAttribute("aria-selected") === "true" &&
      (await page.getByRole("heading", { name: "Copy of Bug Report" }).count()) === 1);
    await page.getByRole("link", { name: 'Edit "Copy of Bug Report"' }).click();
    await page.getByRole("heading", { name: "Template: Copy of Bug Report" }).waitFor();
    await page.getByRole("textbox", { name: "Form title (in forms made from this template)" }).fill("Report a problem");
    await save();
    const copy = await prisma.template.findFirst({ where: { name: "Copy of Bug Report" } });
    check("the copy is edited (version 2)", copy.version === 2 && copy.content.title === "Report a problem" && copy.orgId !== null);
    check("…and the system template is unchanged", JSON.stringify((await prisma.template.findUnique({ where: { id: "sys_form_bug" } })).content) === JSON.stringify(system.content));
    await page.goto(`${WEB}/app/templates/sys_form_bug/edit`);
    await page.getByRole("heading", { name: "Template: Bug Report" }).waitFor();
    check("a system template opened by its address: read-only, no Save", (await page.getByRole("button", { name: "Save", exact: true }).count()) === 0 &&
      (await page.getByText("This is a system template, so it can't be changed.", { exact: false }).count()) === 1);

    // ================= a form from a form template =================
    await page.goto(`${WEB}/app`);
    await page.getByRole("button", { name: "New form" }).first().click();
    const newForm = page.getByRole("dialog", { name: "New form" });
    await newForm.waitFor();
    await newForm.getByRole("button", { name: /Event Registration/ }).click();
    await newForm.getByText("Which date works for you?").waitFor();
    await newForm.getByRole("button", { name: "Use this template" }).click();
    await page.waitForURL(/\/app\/forms\/[^/]+\/edit/);
    await page.getByText("All changes saved").waitFor();
    const madeId = page.url().match(/forms\/([^/]+)\/edit/)[1];
    const made = await latest(madeId);
    const eventTpl = await prisma.template.findUnique({ where: { id: "sys_form_event_registration" } });
    check("a form from a form template: its content, with templateRef", made.title === eventTpl.content.title && made.templateRef?.id === eventTpl.id &&
      made.templateRef.version === eventTpl.version && made.templateRef.name === "Event Registration" && made.blocks.length === eventTpl.content.blocks.length);
    check("…fresh block ids", made.blocks.every((b, i) => /^b_/.test(b.id) && b.id !== eventTpl.content.blocks[i].id));
    const madeRaw = await download();
    check("…its download has no templateRef", !madeRaw.includes("templateRef") && !madeRaw.includes(eventTpl.id));
    await page.locator("[data-block-id]").first().click();
    await page.locator("#block-label").fill("Full name");
    await save();
    check("…and saving it keeps templateRef in the stored content", (await latest(madeId)).templateRef?.id === eventTpl.id);

    // ================= another organisation sees none of these =================
    const otherCtx = await contextFor(B);
    const other = await otherCtx.newPage();
    await other.goto(`${WEB}/app/templates`);
    await other.getByRole("tab", { name: /Your organisation/ }).click();
    await other.getByText("No form templates yet.", { exact: false }).waitFor();
    check("another organisation: its tab is empty", (await other.locator("[data-template-id]").count()) === 0 &&
      (await other.getByRole("tab", { name: /Your organisation/ }).innerText()).trim().endsWith("0"));
    await other.goto(`${WEB}/app/forms/${otherFormId}/edit`);
    await other.getByText("All changes saved").waitFor();
    await other.getByTitle("Insert a block").click();
    await other.getByPlaceholder("Search blocks…").fill("from template");
    await other.keyboard.press("Enter");
    const otherPicker = other.getByRole("dialog", { name: "Insert from a template" });
    await otherPicker.getByText("No group templates yet.", { exact: false }).waitFor();
    check("another organisation: the picker offers none of them", (await otherPicker.getByRole("button", { name: /Smoking details/ }).count()) === 0);
    await otherCtx.close();

    // ================= a viewer sees no write actions =================
    const viewerCtx = await contextFor(V);
    const vp = await viewerCtx.newPage();
    vp.on("pageerror", (e) => check("viewer: no page errors", false, e.message));
    await vp.goto(`${WEB}/app/templates`);
    await vp.locator("li[data-template-id]").first().waitFor();
    await vp.waitForLoadState("networkidle");
    check("viewer, system templates: Preview only — no Use or Duplicate", (await vp.getByRole("button", { name: /^Preview "/ }).count()) === 16 &&
      (await vp.getByRole("button", { name: /^(Use|Duplicate) "/ }).count()) === 0);
    await vp.getByRole("tab", { name: /Your organisation/ }).click();
    const vCard = vp.locator(`li[data-template-id="${tpl.id}"]`);
    await vCard.waitFor();
    check("viewer, the organisation's templates: no Use, Edit, Rename, Duplicate or Delete",
      (await vCard.getByRole("link").count()) === 0 && (await vCard.getByRole("button").allInnerTexts()).join("|").trim() === "Preview" &&
      (await vp.getByRole("button", { name: /^(Use|Duplicate|More actions for) "/ }).count()) === 0 && (await vp.getByRole("link", { name: /^Edit "/ }).count()) === 0);
    await vCard.getByRole("button", { name: 'Preview "Smoking details"' }).click();
    const vPreview = vp.getByRole("dialog", { name: "Smoking details" });
    await vPreview.getByText("Cigarettes a day").first().waitFor();
    check("viewer, preview: only Close", (await vPreview.getByRole("link").count()) === 0 &&
      JSON.stringify((await vPreview.locator("button").allInnerTexts()).map((s) => s.trim()).filter(Boolean)) === JSON.stringify(["Close"]));
    await vPreview.getByRole("button", { name: "Close", exact: true }).last().click();
    await vp.goto(`${WEB}/app`);
    await vp.getByText("Health check").first().waitFor();
    await vp.waitForLoadState("networkidle");
    check("viewer, My forms: no New form", (await vp.getByRole("button", { name: "New form" }).count()) === 0);
    await vp.goto(`${WEB}/app/forms/${healthId}/edit`);
    await vp.locator('[data-block-id="b_group001"]').waitFor();
    await vp.waitForLoadState("networkidle");
    await vp.locator('[data-block-id="b_group001"]').hover();
    check("viewer, editor: no Save as template, for a group or the form",
      (await vp.getByRole("button", { name: /^More actions for group/ }).count()) === 0 && (await vp.getByRole("button", { name: "More form actions" }).count()) === 0);
    await vp.goto(`${WEB}/app/templates/${tpl.id}/edit`);
    await vp.getByRole("heading", { name: "Template: Smoking details" }).waitFor();
    await vp.waitForLoadState("networkidle");
    check("viewer, a template opened by its address: no Save", (await vp.getByRole("button", { name: "Save", exact: true }).count()) === 0);
    await viewerCtx.close();

    // ================= render the form with the template inserted twice (optional) =================
    if (!EXTERNAL_APP) {
      console.log("  SKIP  render in the external test app (set E2E_EXTERNAL_APP_URL and E2E_EXTERNAL_FORMS_DIR to run it)");
    } else if (!process.env.E2E_EXTERNAL_FORMS_DIR || !fs.existsSync(path.join(process.env.E2E_EXTERNAL_FORMS_DIR, ARTIFACT))) {
      check("render: E2E_EXTERNAL_FORMS_DIR is set, so the app has this run's artifact", false, "set E2E_EXTERNAL_FORMS_DIR to the test app's src/forms");
    } else {
      // Condition ids and enableLogic need 0.20.0 or later.
      const installed = path.join(process.env.E2E_EXTERNAL_FORMS_DIR, "..", "..", "node_modules", "@zoworkhq", "forms", "package.json");
      const version = fs.existsSync(installed) ? JSON.parse(fs.readFileSync(installed, "utf8")).version : "not installed";
      const [maj, min] = version.split(".").map(Number);
      check("render: the test app has @zoworkhq/forms 0.20.0 or later", maj > 0 || min >= 20, version);
      await sleep(1500); // let the app's dev server see the new file
      const R = await ctx.newPage();
      R.on("pageerror", (e) => check("render: no page errors", false, e.message));
      await R.goto(`${EXTERNAL_APP}${EXTERNAL_APP.includes("?") ? "&" : "?"}form=builder-templates`);
      const copiesR = R.getByRole("group", { name: "Smoking details", exact: true });
      // The app shows only forms registered in its src/App.tsx; anything else falls back to its default form.
      const registered = await copiesR.first().waitFor({ timeout: 15000 }).then(() => true, () => false);
      check("render: the test app shows ?form=builder-templates", registered,
        "register it in the test app's src/App.tsx, as the other builder exports are: import ./forms/builder-templates-schema.json and add a 'builder-templates' entry");
      if (registered) {
        check("render: the form loads, with both copies", (await copiesR.count()) === 2);
        const [c1, c2] = [copiesR.nth(0), copiesR.nth(1)];
        const quit = (scope, option) => scope.getByRole("group", { name: "Ever tried to quit?", exact: true }).getByRole("radio", { name: option, exact: true }).check();
        const times = (scope) => scope.getByLabel("How many times?", { exact: true });
        const shown = async (scope) => (await times(scope).count()) > 0 && await times(scope).isVisible();
        check("render: How many times? hidden in both at first", !(await shown(c1)) && !(await shown(c2)));
        await quit(c1, "Yes");
        await c1.getByLabel("Cigarettes a day", { exact: true }).fill("20");
        await times(c1).waitFor({ timeout: 5000 }).catch(() => {});
        check("render: copy 1's answers show copy 1's question (1 AND 2), and not copy 2's", await shown(c1) && !(await shown(c2)));
        await quit(c2, "Yes");
        await c2.getByLabel("Cigarettes a day", { exact: true }).fill("5");
        await sleep(300);
        check("render: copy 2 with only condition 1 met: still hidden", !(await shown(c2)));
        await c2.getByLabel("Cigarettes a day", { exact: true }).fill("15");
        await times(c2).waitFor({ timeout: 5000 }).catch(() => {});
        check("render: copy 2 with both met: shown", await shown(c2));
        await times(c1).fill("2");
        await times(c2).fill("4");
        await quit(c1, "No");
        await sleep(300);
        check("render: changing copy 1 hides only copy 1's question", !(await shown(c1)) && await shown(c2));
        await R.getByLabel("Your name", { exact: true }).fill("Ann");
        const [res] = await Promise.all([
          R.waitForResponse((x) => /\/api\/submit$/.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 15000 }),
          R.getByRole("button", { name: "Submit", exact: true }).click(),
        ]);
        check("render: submits (201)", res.status() === 201, String(res.status()));
        const sent = JSON.parse(res.request().postData()).answers;
        const [t1, t2] = copies.map((g) => timesOf(g).id);
        // Each answer is sent as { state, value }.
        check("payload: copy 2's answer is sent, copy 1's hidden one isn't", sent[t2]?.value === 4 && !(t1 in sent), JSON.stringify(sent));
        await R.screenshot({ path: `${OUT}/templates-render.png`, fullPage: true });
      }
      await R.close();
    }
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    if (browser) await browser.close();
    for (const email of emails) {
      const u = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
      if (!u) continue;
      for (const m of u.memberships) await prisma.organization.delete({ where: { id: m.orgId } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  let ok = true;
  for (const [name, pass, detail] of results) {
    if (!pass) ok = false;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${!pass && detail ? "   [" + detail + "]" : ""}`);
  }
  console.log(`\n  ${results.filter((r) => r[1]).length}/${results.length} passed`);
  process.exit(ok ? 0 : 1);
})();
