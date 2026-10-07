// `audio` authoring in the builder (contract §11): the recognised-source save rule (API + editor,
// same message, shown once), the inspector's heading and hints, a canvas preview that loads
// nothing, trimming, and the artifact for the end-to-end render.
const fs = require("fs");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact } = require("./_setup");
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
const AUDIO_MSG = (p) =>
  `Audio "${p}": add the address of an .mp3, .m4a, .ogg or .wav file (https:// or a path on your app's server such as /audio/welcome.mp3).`;
const RELATIVE = "/audio/welcome.mp3";
const HTTPS = "https://cdn.example.com/audio/pharmacy-hours.m4a?v=2";
const CONDITIONAL = "/audio/breathing.ogg";
const UNRECOGNISED = "https://cdn.example.com/welcome.flac";
// The canvas names the file instead of loading it: nothing with an audio extension may be requested.
const AUDIO_REQUEST = /\.(?:mp3|m4a|ogg|wav)$/i;
const walk = function* (bs) { for (const b of bs) { yield b; if (b.blocks) yield* walk(b.blocks); } };

(async () => {
  const email = `verify-audio-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Audio" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const put = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;
    const remove = (id) => fetch(`${API}/v1/forms/${id}`, { method: "DELETE", headers: H });

    // ---------- API ----------
    const apiId = await create("API checks");
    const aud = (content, label = "Welcome") => ({ id: "aud", type: "audio", label, required: false, content });
    const msg = async (r) => (await r.json()).message;
    let r = await put(apiId, { title: "t", blocks: [aud(UNRECOGNISED)] });
    check("API: an unrecognised audio source (.flac) is refused (400) with the message", r.status === 400 && (await msg(r)) === AUDIO_MSG("Welcome"));
    r = await put(apiId, { title: "t", blocks: [aud("")] });
    check("API: an empty audio source is refused", r.status === 400 && (await msg(r)) === AUDIO_MSG("Welcome"));
    r = await put(apiId, { title: "t", blocks: [aud("https://open.spotify.com/track/abc")] });
    check("API: a streaming-service link is refused", r.status === 400 && (await msg(r)) === AUDIO_MSG("Welcome"));
    r = await put(apiId, { title: "t", blocks: [aud("https://cdn.example.com/?file=welcome.mp3")] });
    check("API: a file name only in the query is refused", r.status === 400 && (await msg(r)) === AUDIO_MSG("Welcome"));
    r = await put(apiId, { title: "t", blocks: [aud("http://cdn.example.com/welcome.mp3")] });
    check("API: http:// is refused", r.status === 400 && (await msg(r)) === AUDIO_MSG("Welcome"));
    r = await put(apiId, { title: "t", blocks: [{ id: "p1", type: "page", title: "Visit", blocks: [{ id: "g", type: "group", label: "Media", blocks: [aud("https://user@cdn.example.com/welcome.mp3")] }] }] });
    check("API: refused inside a page and group, named by its path", r.status === 400 && (await msg(r)) === AUDIO_MSG("Visit › Media › Welcome"));
    r = await put(apiId, { title: "t", blocks: [aud(RELATIVE), { id: "q", type: "short", label: "Q", enableWhen: [{ question: "aud", operator: "exists" }] }] });
    const sourceMsg = r.status === 400 ? await msg(r) : "";
    check("API: an audio block can't be a condition source", r.status === 400 && /^Block "Q": "Welcome" is a audio block, which can't be used in a condition\.$/.test(sourceMsg), sourceMsg);
    r = await put(apiId, { title: "t", blocks: [aud(`  ${HTTPS} \n`), { id: "q", type: "short", label: "Q", description: "" }] });
    const s1 = await stored(apiId);
    check("API: a padded source saves, stored trimmed", r.status === 200 && s1.blocks[0].content === HTTPS, JSON.stringify(s1.blocks[0]));
    r = await put(apiId, { title: "t", blocks: [aud(HTTPS), { id: "q", type: "short", label: "Q" }] });
    check("API: the same source without the padding is no change (409 NO_CHANGES)", r.status === 409 && (await r.json()).code === "NO_CHANGES");
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
    const audioRequests = [];
    P.on("request", (req) => { if (AUDIO_REQUEST.test(new URL(req.url()).pathname)) audioRequests.push(req.url()); });
    const cards = P.locator("[data-block-id]");
    const labelInput = P.locator("#block-label");
    const urlInput = P.locator("#block-url");
    const content = P.locator("aside textarea");
    const pick = (name) => P.getByRole("button", { name, exact: true }).click();
    const add = async (name) => { await P.getByTitle("Insert a block").click(); await pick(name); };
    const rename = (label) => labelInput.fill(label);
    const inline = () => P.locator("aside").getByRole("alert");
    const helpField = () => P.locator("aside").getByText("Help text", { exact: true });
    const requiredToggle = () => P.locator("aside").getByRole("switch");
    // The inspector's heading (textContent: the CSS upper-cases it), and how often a phrase appears in it.
    const inspectorHeading = () => P.locator("aside h4").first().textContent();
    const timesShown = async (phrase) => (await P.locator("aside").innerText()).toLowerCase().split(phrase.toLowerCase()).length - 1;
    const redMessages = () => P.locator("aside .text-red").count();
    const logicSays = (noun) => P.locator("aside").getByText(`Show this ${noun} only when…`, { exact: true }).isVisible();
    const cardOf = (label) => cards.filter({ has: P.locator("span.truncate", { hasText: new RegExp(`^${label.replace(/[?()]/g, "\\$&")}$`) }) }).first();
    // The preview is the last truncated span on the card; the first is the card's own label.
    const preview = (label) => cardOf(label).locator("span.min-w-0.truncate").last();
    const notice = P.getByRole("alert").filter({ hasText: /Couldn't save/ });
    const save = async () => { await P.getByRole("button", { name: "Save", exact: true }).click(); await P.getByText("All changes saved").waitFor({ timeout: 10000 }); };

    const formId = await create("Before your appointment");
    await P.goto(`${WEB}/app/forms/${formId}/edit`);
    await P.getByText("All changes saved").waitFor();

    await add("Multiple choice"); await rename("Would you like a guided breathing exercise?");
    // Labels only: each code is generated from its label on leaving the field (contract §13.3).
    await P.getByRole("button", { name: "Remove option 3" }).click();
    await P.locator("#options-0-label").fill("Yes"); await P.locator("#options-1-label").fill("No");
    await P.locator("#options-1-label").blur();

    // A file on the app's own server.
    await add("Audio");
    check("audio: the inspector calls it an Audio block, not a Question", (await inspectorHeading()) === "Audio", await inspectorHeading());
    check("audio: the Logic section says 'this audio block', not 'this question'", await logicSays("audio block"));
    check("audio: help text hidden (not answerable)", (await helpField().count()) === 0);
    check("audio: no Required toggle", (await requiredToggle().count()) === 0);
    check("audio: the screen-reader note sits under Label",
      await P.locator("aside").getByText("Read aloud to screen-reader users — say what the recording is.").isVisible());
    check("audio: the URL hint names the recognised file types",
      (await urlInput.getAttribute("placeholder")) === "An .mp3, .m4a, .ogg or .wav address");
    check("audio: the transcript note sits under the URL field",
      await P.locator("aside").getByText("Add a transcript in a Text block next to it so everyone can follow.").isVisible());
    await rename("Welcome message");
    check("audio: an empty source shows the rule's message inline, and 'Add an audio file' on the canvas",
      (await inline().innerText()) === AUDIO_MSG("Welcome message") && (await preview("Welcome message").innerText()) === "Add an audio file",
      await inline().innerText().catch(() => ""));
    check("audio: the URL field is marked invalid", (await urlInput.getAttribute("aria-invalid")) === "true");
    await urlInput.fill(UNRECOGNISED);
    check("audio: an unrecognised file keeps the message as the author types, and the canvas still asks for a file",
      (await inline().innerText()) === AUDIO_MSG("Welcome message") && (await preview("Welcome message").innerText()) === "Add an audio file");
    check("audio: the message is shown once, under the field — not again under Logic",
      (await timesShown("add the address of an .mp3")) === 1 && (await redMessages()) === 1, `${await timesShown("add the address of an .mp3")} / ${await redMessages()}`);
    await P.screenshot({ path: `${OUT}/audio-1-unrecognised.png` });

    // A save with that file is refused, with the same message as the inline one.
    const editorMsg = await inline().innerText();
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await notice.waitFor({ timeout: 10000 });
    const apiMsg = (await notice.innerText()).replace(/^Couldn't save:\s*/, "").trim();
    check("save refused: unrecognised audio — the editor's inline message and the API's are the same",
      apiMsg === editorMsg && apiMsg === AUDIO_MSG("Welcome message"), `${apiMsg} | ${editorMsg}`);
    await P.getByRole("button", { name: "Dismiss" }).click();

    await urlInput.fill(`  ${RELATIVE}  `);
    check("audio: a recognised file clears the message", (await inline().count()) === 0 && (await urlInput.getAttribute("aria-invalid")) === "false");
    check("audio canvas: a file on the app's server shows its trimmed path", (await preview("Welcome message").innerText()) === `Audio file · ${RELATIVE}`,
      await preview("Welcome message").innerText());

    // Its transcript, as the inspector suggests.
    await add("Text"); await rename("Welcome message transcript");
    await content.fill("Hello, and thank you for choosing our clinic.\nPlease bring your insurance card.");

    // An https:// file.
    await add("Audio"); await rename("Pharmacy opening hours");
    await urlInput.fill(HTTPS);
    check("audio canvas: an https:// file shows its address", (await preview("Pharmacy opening hours").innerText()) === `Audio file · ${HTTPS}`);

    // Shown only when the patient asks for it.
    await add("Audio"); await rename("Breathing exercise");
    await urlInput.fill(`\t${CONDITIONAL} `);
    const choiceId = await cardOf("Would you like a guided breathing exercise?").getAttribute("data-block-id");
    const audioIds = await Promise.all(["Welcome message", "Pharmacy opening hours"].map((l) => cardOf(l).getAttribute("data-block-id")));
    await P.getByRole("button", { name: "Add condition" }).click();
    const sources = await P.getByRole("combobox", { name: "Question" }).first().locator("option").evaluateAll((os) => os.map((o) => o.value));
    check("conditions: earlier audio blocks aren't offered as a condition source", sources.includes(choiceId) && !audioIds.some((id) => sources.includes(id)), JSON.stringify(sources));
    await P.getByRole("combobox", { name: "Question" }).first().selectOption(choiceId);
    await P.getByRole("combobox", { name: "Condition" }).first().selectOption("=");
    await P.getByRole("combobox", { name: "Answer" }).first().selectOption("Yes");
    check("audio: no Logic problem shown for a valid conditional audio block", (await redMessages()) === 0);

    check("audio canvas: no <audio> element on the canvas", (await P.locator("main audio, [data-block-id] audio").count()) === 0);
    check("audio canvas: no audio file requested", audioRequests.length === 0, audioRequests.join(", "));
    await P.locator('input[placeholder="Add a description…"]').click();
    await P.screenshot({ path: `${OUT}/audio-2-canvas.png` });

    await save();
    const s2 = await stored(formId);
    const all = [...walk(s2.blocks)];
    const srcs = all.filter((b) => b.type === "audio").map((b) => b.content);
    check("saved: audio sources trimmed", JSON.stringify(srcs) === JSON.stringify([RELATIVE, HTTPS, CONDITIONAL]), JSON.stringify(srcs));
    check("saved: no description on any audio block", all.filter((b) => b.type === "audio").every((b) => !("description" in b)));

    // Re-typing a source with padding is no change: the comparison trims as the save does.
    await cardOf("Pharmacy opening hours").locator("span.truncate", { hasText: /^Pharmacy opening hours$/ }).click();
    await urlInput.fill(`   ${HTTPS}   `);
    check("editor: padding a saved source isn't an unsaved change", (await P.getByText("Unsaved changes").count()) === 0 && await P.getByText("All changes saved").isVisible());

    const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    const art = JSON.parse(raw);
    const aAudio = [...walk(art.blocks)].filter((b) => b.type === "audio");
    check("artifact: audio sources trimmed, as authored", JSON.stringify(aAudio.map((b) => b.content)) === JSON.stringify([RELATIVE, HTTPS, CONDITIONAL]), JSON.stringify(aAudio.map((b) => b.content)));
    check("artifact: each audio block has exactly id, type, label, required: false, content (+ its condition)",
      aAudio.every((b) => b.label && b.required === false && !("description" in b) &&
        Object.keys(b).sort().join() === (b.enableWhen ? "content,enableWhen,id,label,required,type" : "content,id,label,required,type")) &&
      JSON.stringify(aAudio.map((b) => b.label)) === JSON.stringify(["Welcome message", "Pharmacy opening hours", "Breathing exercise"]),
      JSON.stringify(aAudio));
    check("artifact: the conditional audio carries its condition",
      JSON.stringify(aAudio[2].enableWhen) === JSON.stringify([{ question: choiceId, operator: "=", answer: "yes" }]) && aAudio.slice(0, 2).every((b) => !b.enableWhen));
    saveArtifact("builder-audio-schema.json", raw);
    await remove(formId);
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const p = browser?.contexts()[0]?.pages()[0]; if (p) await p.screenshot({ path: `${OUT}/audio-failure.png` }); } catch {}
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
