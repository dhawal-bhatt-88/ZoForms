// `text` and `image` authoring in the builder: rules (API + editor, same message), previews,
// help text, trimming, and the artifact for the end-to-end render.
const fs = require("fs");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact, noIds, hasIds } = require("./_setup");
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
const IMAGE_MSG = (p) => `Image "${p}": add an image address starting with https:// or a path on your app's server such as /images/logo.png.`;
const TEXT_MSG = (p) => `Text block "${p}" is empty — add some text or delete it.`;
const HTTPS_SRC = "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png";
const walk = function* (bs) { for (const b of bs) { yield b; if (b.blocks) yield* walk(b.blocks); } };

(async () => {
  const email = `verify-display-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Display" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const put = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;
    const remove = (id) => fetch(`${API}/v1/forms/${id}`, { method: "DELETE", headers: H });

    // ---------- API ----------
    const apiId = await create("API checks");
    const img = (content, label = "Logo") => ({ id: "img", type: "image", label, required: false, content });
    const txt = (content, label = "Welcome") => ({ id: "txt", type: "text", label, required: false, content });
    const msg = async (r) => (await r.json()).message;
    let r = await put(apiId, { title: "t", blocks: [img("not a url at all")] });
    check("API: an invalid image source is refused (400) with the message", r.status === 400 && (await msg(r)) === IMAGE_MSG("Logo"));
    r = await put(apiId, { title: "t", blocks: [img("")] });
    check("API: an empty image source is refused", r.status === 400 && (await msg(r)) === IMAGE_MSG("Logo"));
    r = await put(apiId, { title: "t", blocks: [{ id: "p1", type: "page", title: "Visit", blocks: [txt("  \n ")] }] });
    check("API: a blank text block is refused, named by its path", r.status === 400 && (await msg(r)) === TEXT_MSG("Visit › Welcome"));
    r = await put(apiId, { title: "t", blocks: [img("  /images/logo.png \n"), { id: "q", type: "short", label: "Q", description: "" }] });
    const s1 = await stored(apiId);
    check("API: a padded image source saves, stored trimmed", r.status === 200 && s1.blocks[0].content === "/images/logo.png", JSON.stringify(s1.blocks[0]));
    check('API: description: "" is not stored', !("description" in s1.blocks[1]), JSON.stringify(s1.blocks[1]));
    await remove(apiId);

    // ---------- editor ----------
    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1400 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    P.on("dialog", (d) => d.accept());
    const cards = P.locator("[data-block-id]");
    const labelInput = P.locator("#block-label");
    const urlInput = P.locator("#block-url");
    const content = P.locator("aside textarea");
    // A block in the insert menu (a listbox of options).
    const pick = (name) => P.getByRole("option", { name, exact: true }).click();
    const add = async (name) => { await P.getByTitle("Insert a block").click(); await pick(name); };
    const rename = (label) => labelInput.fill(label);
    const inline = () => P.locator("aside").getByRole("alert");
    const helpField = () => P.locator("aside").getByText("Help text", { exact: true });
    // The inspector's heading (textContent: the CSS upper-cases it), and how often a phrase appears in it.
    const inspectorHeading = () => P.locator("aside h2").first().textContent();
    const timesShown = async (phrase) => (await P.locator("aside").innerText()).toLowerCase().split(phrase.toLowerCase()).length - 1;
    const redMessages = () => P.locator("aside [data-field-error]").count();
    const logicSays = (noun) => P.locator("aside").getByText(`Show this ${noun} only when…`, { exact: true }).isVisible();
    const cardOf = (label) => cards.filter({ has: P.locator("span.truncate", { hasText: new RegExp(`^${label.replace(/[?()]/g, "\\$&")}$`) }) }).first();
    const select = (label) => cardOf(label).locator("span.truncate").click();
    const notice = P.getByRole("alert").filter({ hasText: /Couldn't save/ });
    const save = async () => { await P.getByRole("button", { name: "Save", exact: true }).click(); await P.getByText("All changes saved").waitFor({ timeout: 10000 }); };

    const formId = await create("Clinic visit");
    await P.goto(`${WEB}/app/forms/${formId}/edit`);
    await P.getByText("All changes saved").waitFor();

    await add("Multiple choice"); await rename("Would you like directions?");
    // Labels only: each code is generated from its label on leaving the field (contract §13.3).
    await P.getByRole("button", { name: "Remove option 3" }).click();
    await P.locator("#options-0-label").fill("Yes"); await P.locator("#options-1-label").fill("No");
    await P.locator("#options-1-label").blur();

    await add("Text"); await rename("Welcome");
    check("text: the inspector calls it a Text block, not a Question", (await inspectorHeading()) === "Text", await inspectorHeading());
    check("text: the Logic section says 'this text block', not 'this question'", await logicSays("text block"));
    check("help text hidden on a text block", (await helpField().count()) === 0);
    await content.fill("Welcome to the clinic.\nPlease arrive 10 minutes early.");
    const textPreview = cardOf("Welcome").locator("p.whitespace-pre-line");
    check("text canvas keeps line breaks (white-space: pre-line)",
      (await textPreview.evaluate((e) => getComputedStyle(e).whiteSpace)) === "pre-line" && (await textPreview.innerText()).includes("\n"), await textPreview.innerText());

    await add("Image");
    check("image: the inspector calls it an Image block, not a Question", (await inspectorHeading()) === "Image", await inspectorHeading());
    check("image: the Logic section says 'this image block', not 'this question'", await logicSays("image block"));
    check("help text hidden on an image block", (await helpField().count()) === 0);
    check("image: the screen-reader note sits under Label",
      await P.locator("aside").getByText("Also read aloud to screen-reader users — describe what the image shows.").isVisible());
    check("image: the URL hint mentions paths on the app's server",
      (await urlInput.getAttribute("placeholder")) === "https://… or a path on your app's server, e.g. /images/logo.png");
    await rename("Clinic logo");
    check("image: an empty source shows the rule's message inline, and 'Add an image address' on the canvas",
      (await inline().innerText()) === IMAGE_MSG("Clinic logo") && await cardOf("Clinic logo").getByText("Add an image address").isVisible(), await inline().innerText().catch(() => ""));
    await urlInput.fill("logo");
    check("image: an invalid source keeps the message as the author types", (await inline().innerText()) === IMAGE_MSG("Clinic logo"));
    check("image: the message is shown once, under the field — not again under Logic",
      (await timesShown("add an image address")) === 1 && (await redMessages()) === 1, `${await timesShown("add an image address")} / ${await redMessages()}`);
    await P.screenshot({ path: `${OUT}/display-1-invalid-image.png` });

    // A save with that invalid image is refused, with the same message as the inline one.
    const editorMsg = await inline().innerText();
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await notice.waitFor({ timeout: 10000 });
    const apiMsg = (await notice.innerText()).replace(/^Couldn't save:\s*/, "").trim();
    check("save refused: invalid image — the editor's inline message and the API's are the same", apiMsg === editorMsg && apiMsg === IMAGE_MSG("Clinic logo"), `${apiMsg} | ${editorMsg}`);
    await P.getByRole("button", { name: "Dismiss" }).click();

    await urlInput.fill(`  ${HTTPS_SRC}  `);
    check("image: a valid https source clears the message", (await inline().count()) === 0);
    const imgEl = cardOf("Clinic logo").locator("img");
    check("image canvas: https source shown, with referrerPolicy no-referrer",
      (await imgEl.getAttribute("src")) === HTTPS_SRC && (await imgEl.getAttribute("referrerpolicy")) === "no-referrer");

    await add("Image"); await rename("Clinic entrance");
    await urlInput.fill(" /images/clinic-entrance.png ");
    check("image canvas: a /path source isn't loaded; a placeholder names it",
      await cardOf("Clinic entrance").getByText("Shown from the app's own server: /images/clinic-entrance.png").isVisible() && (await cardOf("Clinic entrance").locator("img").count()) === 0);

    await add("Text"); await rename("Directions");
    await content.fill("   ");
    check("text: a blank text block shows its message inline", (await inline().innerText()) === TEXT_MSG("Directions"));
    check("text: the message is shown once, under the field — not again under Logic",
      (await timesShown("add some text or delete it")) === 1 && (await redMessages()) === 1, `${await timesShown("add some text or delete it")} / ${await redMessages()}`);
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await notice.waitFor({ timeout: 10000 });
    check("save refused: blank text, with the message", (await notice.innerText()).includes(TEXT_MSG("Directions")), await notice.innerText());
    await P.getByRole("button", { name: "Dismiss" }).click();
    await content.fill("Turn left at the pharmacy.\nWe're on the second floor.");
    const choiceId = await cardOf("Would you like directions?").getAttribute("data-block-id");
    await P.getByRole("button", { name: "Add condition" }).click();
    await P.getByRole("combobox", { name: "Question" }).first().selectOption(choiceId);
    await P.getByRole("combobox", { name: "operator" }).first().selectOption("=");
    await P.getByRole("combobox", { name: "Answer" }).first().selectOption("Yes");

    await add("Short answer"); await rename("Full name");
    check("a question is still headed Question, and its Logic says 'this question'", (await inspectorHeading()) === "Question" && await logicSays("question"));
    check("help text shown on a question", await helpField().isVisible());
    // Marked optional in its label, not by a placeholder.
    const help = P.locator("#block-help");
    await help.fill("As on your ID");
    await help.fill("");
    await add("Heading 2");
    check("help text hidden on a heading (presentational)", (await helpField().count()) === 0);
    await rename("Before you arrive");
    // Presentational previews show what the renderer shows (never an input box).
    const heading = cardOf("Before you arrive");
    check("heading preview: its text, at its level, not an input",
      (await heading.locator("div.font-bold.text-lg", { hasText: "Before you arrive" }).count()) === 1 && !(await heading.innerText()).includes("Short answer"),
      await heading.innerText());
    await P.locator("aside").getByRole("radio", { name: "H1", exact: true }).click();
    check("heading preview: level 1 is larger", (await heading.locator("div.font-bold.text-2xl", { hasText: "Before you arrive" }).count()) === 1);
    await add("Title");
    const titleCard = () => cards.last();
    check("title preview: its content", (await titleCard().locator("div.text-xl").innerText()) === "Section title");
    // One field, Text: the label follows it, and blank shows the default, as respondents see it.
    await P.locator("#block-content").fill("");
    check("title preview: empty text shows its default label, Title", (await titleCard().locator("div.text-xl").innerText()) === "Title");
    await P.locator("#block-content").fill("Your visit");
    check("title preview: its text", (await titleCard().locator("div.text-xl").innerText()) === "Your visit");
    await add("Label");
    await P.locator("#block-content").fill("Appointment details");
    check("label preview: its content", (await cards.last().locator("div.uppercase").textContent()) === "Appointment details");
    await add("Divider");
    check("divider preview: a rule", (await cards.last().locator("hr").count()) === 1);
    await P.locator('input[placeholder="Add a description…"]').click();
    await P.setViewportSize({ width: 1440, height: 1800 });
    await sleep(300);
    await P.screenshot({ path: `${OUT}/display-2-canvas.png` });
    await P.setViewportSize({ width: 1440, height: 1400 });

    await save();
    const s2 = await stored(formId);
    const all = [...walk(s2.blocks)];
    const imgs = all.filter((b) => b.type === "image").map((b) => b.content);
    check("saved: image sources trimmed", JSON.stringify(imgs) === JSON.stringify([HTTPS_SRC, "/images/clinic-entrance.png"]), JSON.stringify(imgs));
    check('saved: the cleared help text is absent, not ""', all.every((b) => !("description" in b)), JSON.stringify(all.map((b) => b.description)));

    const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    const art = JSON.parse(raw);
    const aBlocks = [...walk(art.blocks)];
    check("artifact: image sources trimmed", JSON.stringify(aBlocks.filter((b) => b.type === "image").map((b) => b.content)) === JSON.stringify([HTTPS_SRC, "/images/clinic-entrance.png"]));
    check('artifact: no description: "" anywhere', !raw.includes('"description": ""') && !raw.includes('"description":""'));
    check("artifact: multi-line text kept, conditional text carries its condition",
      aBlocks.find((b) => b.label === "Welcome").content === "Welcome to the clinic.\nPlease arrive 10 minutes early." &&
      JSON.stringify(noIds(aBlocks.find((b) => b.label === "Directions").enableWhen)) === JSON.stringify([{ question: choiceId, operator: "=", answer: "yes" }]) &&
      hasIds(aBlocks.find((b) => b.label === "Directions").enableWhen));
    saveArtifact("builder-display-blocks-schema.json", raw);
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const p = browser?.contexts()[0]?.pages()[0]; if (p) await p.screenshot({ path: `${OUT}/display-failure.png` }); } catch {}
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
