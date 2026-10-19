// `video` authoring in the builder (contract §10): the recognised-source save rule (API + editor,
// same message), canvas previews that load nothing third-party, help text, trimming, and the
// artifact for the end-to-end render.
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
const VIDEO_MSG = (p) =>
  `Video "${p}": paste a YouTube or Vimeo link, or the address of an .mp4 or .webm file (https:// or a path on your app's server such as /videos/intro.mp4).`;
const YOUTUBE = "https://youtu.be/dQw4w9WgXcQ?t=90";
const VIMEO = "https://vimeo.com/76979871";
const FILE = "/videos/intro.mp4";
const UNRECOGNISED = "https://www.youtube.com/playlist?list=PL123";
// Hosts the canvas must never contact: it names the video instead of loading a player.
const THIRD_PARTY = /youtube\.com|youtu\.be|youtube-nocookie\.com|ytimg\.com|vimeo\.com|vimeocdn\.com/;
const walk = function* (bs) { for (const b of bs) { yield b; if (b.blocks) yield* walk(b.blocks); } };

(async () => {
  const email = `verify-video-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Video" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const put = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;
    const remove = (id) => fetch(`${API}/v1/forms/${id}`, { method: "DELETE", headers: H });

    // ---------- API ----------
    const apiId = await create("API checks");
    const vid = (content, label = "Intro") => ({ id: "vid", type: "video", label, required: false, content });
    const msg = async (r) => (await r.json()).message;
    let r = await put(apiId, { title: "t", blocks: [vid(UNRECOGNISED)] });
    check("API: an unrecognised video source is refused (400) with the message", r.status === 400 && (await msg(r)) === VIDEO_MSG("Intro"));
    r = await put(apiId, { title: "t", blocks: [vid("")] });
    check("API: an empty video source is refused", r.status === 400 && (await msg(r)) === VIDEO_MSG("Intro"));
    r = await put(apiId, { title: "t", blocks: [vid("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ")] });
    check("API: a look-alike host is refused", r.status === 400 && (await msg(r)) === VIDEO_MSG("Intro"));
    r = await put(apiId, { title: "t", blocks: [vid("https://cdn.example.com/intro.mov")] });
    check("API: a file that isn't .mp4/.webm is refused", r.status === 400 && (await msg(r)) === VIDEO_MSG("Intro"));
    r = await put(apiId, { title: "t", blocks: [{ id: "p1", type: "page", title: "Visit", blocks: [{ id: "g", type: "group", label: "Media", blocks: [vid("https://user@cdn.example.com/intro.mp4")] }] }] });
    check("API: refused inside a page and group, named by its path", r.status === 400 && (await msg(r)) === VIDEO_MSG("Visit › Media › Intro"));
    r = await put(apiId, { title: "t", blocks: [vid(YOUTUBE), { id: "q", type: "short", label: "Q", enableWhen: [{ question: "vid", operator: "exists" }] }] });
    check("API: a video can't be a condition source", r.status === 400 && (await msg(r)) === 'Block "Q": "Intro" is a video block, which can\'t be used in a condition.');
    r = await put(apiId, { title: "t", blocks: [vid(`  ${YOUTUBE} \n`), { id: "q", type: "short", label: "Q", description: "" }] });
    const s1 = await stored(apiId);
    check("API: a padded source saves, stored trimmed", r.status === 200 && s1.blocks[0].content === YOUTUBE, JSON.stringify(s1.blocks[0]));
    r = await put(apiId, { title: "t", blocks: [vid(YOUTUBE), { id: "q", type: "short", label: "Q" }] });
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
    const thirdParty = [];
    P.on("request", (req) => { if (THIRD_PARTY.test(new URL(req.url()).hostname)) thirdParty.push(req.url()); });
    const cards = P.locator("[data-block-id]");
    const labelInput = P.locator("#block-label");
    const urlInput = P.locator("#block-url");
    const pick = (name) => P.getByRole("button", { name, exact: true }).click();
    const add = async (name) => { await P.getByTitle("Insert a block").click(); await pick(name); };
    const rename = (label) => labelInput.fill(label);
    const inline = () => P.locator("aside").getByRole("alert");
    const helpField = () => P.locator("aside").getByText("Help text", { exact: true });
    // The inspector's heading (textContent: the CSS upper-cases it), and how often a phrase appears in it.
    const inspectorHeading = () => P.locator("aside h4").first().textContent();
    const timesShown = async (phrase) => (await P.locator("aside").innerText()).toLowerCase().split(phrase.toLowerCase()).length - 1;
    const redMessages = () => P.locator("aside [data-field-error]").count();
    const logicSays = (noun) => P.locator("aside").getByText(`Show this ${noun} only when…`, { exact: true }).isVisible();
    const requiredToggle = () => P.locator("aside").getByRole("switch");
    const cardOf = (label) => cards.filter({ has: P.locator("span.truncate", { hasText: new RegExp(`^${label.replace(/[?()]/g, "\\$&")}$`) }) }).first();
    // The preview is the last truncated span on the card; the first is the card's own label.
    const preview = (label) => cardOf(label).locator("span.min-w-0.truncate").last();
    const notice = P.getByRole("alert").filter({ hasText: /Couldn't save/ });
    const save = async () => { await P.getByRole("button", { name: "Save", exact: true }).click(); await P.getByText("All changes saved").waitFor({ timeout: 10000 }); };

    const formId = await create("Clinic tour");
    await P.goto(`${WEB}/app/forms/${formId}/edit`);
    await P.getByText("All changes saved").waitFor();

    await add("Multiple choice"); await rename("Would you like a tour of the clinic?");
    // Labels only: each code is generated from its label on leaving the field (contract §13.3).
    await P.getByRole("button", { name: "Remove option 3" }).click();
    await P.locator("#options-0-label").fill("Yes"); await P.locator("#options-1-label").fill("No");
    await P.locator("#options-1-label").blur();

    // YouTube, with a start time.
    await add("Video");
    check("video: the inspector calls it a Video block, not a Question", (await inspectorHeading()) === "Video", await inspectorHeading());
    check("video: the Logic section says 'this video block', not 'this question'", await logicSays("video block"));
    check("video: help text hidden (not answerable)", (await helpField().count()) === 0);
    check("video: no Required toggle", (await requiredToggle().count()) === 0);
    check("video: the screen-reader note sits under Label",
      await P.locator("aside").getByText("Read aloud to screen-reader users — describe what the video is about.").isVisible());
    check("video: the URL hint names the recognised sources",
      (await urlInput.getAttribute("placeholder")) === "YouTube or Vimeo link, or an .mp4 / .webm address");
    await rename("Welcome from the team");
    check("video: an empty source shows the rule's message inline, and 'Add a video link' on the canvas",
      (await inline().innerText()) === VIDEO_MSG("Welcome from the team") && (await preview("Welcome from the team").innerText()) === "Add a video link",
      await inline().innerText().catch(() => ""));
    check("video: the URL field is marked invalid", (await urlInput.getAttribute("aria-invalid")) === "true");
    await urlInput.fill(UNRECOGNISED);
    check("video: an unrecognised link keeps the message as the author types, and the canvas still asks for a link",
      (await inline().innerText()) === VIDEO_MSG("Welcome from the team") && (await preview("Welcome from the team").innerText()) === "Add a video link");
    check("video: the message is shown once, under the field — not again under Logic",
      (await timesShown("paste a YouTube or Vimeo link")) === 1 && (await redMessages()) === 1, `${await timesShown("paste a YouTube or Vimeo link")} / ${await redMessages()}`);
    await P.screenshot({ path: `${OUT}/video-1-unrecognised.png` });

    // A save with that link is refused, with the same message as the inline one.
    const editorMsg = await inline().innerText();
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await notice.waitFor({ timeout: 10000 });
    const apiMsg = (await notice.innerText()).replace(/^Couldn't save:\s*/, "").trim();
    check("save refused: unrecognised video — the editor's inline message and the API's are the same",
      apiMsg === editorMsg && apiMsg === VIDEO_MSG("Welcome from the team"), `${apiMsg} | ${editorMsg}`);
    await P.getByRole("button", { name: "Dismiss" }).click();

    await urlInput.fill(`  ${YOUTUBE}  `);
    check("video: a recognised YouTube link clears the message", (await inline().count()) === 0 && (await urlInput.getAttribute("aria-invalid")) !== "true");
    check("video canvas: YouTube shows its ID and start time", (await preview("Welcome from the team").innerText()) === "YouTube video · dQw4w9WgXcQ · from 1:30",
      await preview("Welcome from the team").innerText());

    // Vimeo.
    await add("Video"); await rename("Pharmacy walkthrough");
    await urlInput.fill(VIMEO);
    check("video canvas: Vimeo shows its ID", (await preview("Pharmacy walkthrough").innerText()) === "Vimeo video · 76979871");

    // A file on the app's own server, shown only when the patient asks for a tour.
    await add("Video"); await rename("Clinic tour");
    await urlInput.fill(` ${FILE}\t`);
    check("video canvas: a file shows its trimmed path", (await preview("Clinic tour").innerText()) === `Video file · ${FILE}`);
    const choiceId = await cardOf("Would you like a tour of the clinic?").getAttribute("data-block-id");
    const videoIds = await Promise.all(["Welcome from the team", "Pharmacy walkthrough"].map((l) => cardOf(l).getAttribute("data-block-id")));
    await P.getByRole("button", { name: "Add condition" }).click();
    const sources = await P.getByRole("combobox", { name: "Question" }).first().locator("option").evaluateAll((os) => os.map((o) => o.value));
    check("conditions: earlier videos aren't offered as a condition source", sources.includes(choiceId) && !videoIds.some((id) => sources.includes(id)), JSON.stringify(sources));
    await P.getByRole("combobox", { name: "Question" }).first().selectOption(choiceId);
    await P.getByRole("combobox", { name: "operator" }).first().selectOption("=");
    await P.getByRole("combobox", { name: "Answer" }).first().selectOption("Yes");

    check("video canvas: no player, iframe or <video> on the canvas", (await P.locator("main iframe, main video, [data-block-id] iframe, [data-block-id] video").count()) === 0);
    check("video canvas: nothing requested from YouTube or Vimeo", thirdParty.length === 0, thirdParty.join(", "));
    await P.locator('input[placeholder="Add a description…"]').click();
    await P.screenshot({ path: `${OUT}/video-2-canvas.png` });

    await save();
    const s2 = await stored(formId);
    const all = [...walk(s2.blocks)];
    const srcs = all.filter((b) => b.type === "video").map((b) => b.content);
    check("saved: video sources trimmed", JSON.stringify(srcs) === JSON.stringify([YOUTUBE, VIMEO, FILE]), JSON.stringify(srcs));
    check('saved: no description on any video', all.filter((b) => b.type === "video").every((b) => !("description" in b)));

    // Re-typing a source with padding is no change: the comparison trims as the save does.
    await cardOf("Pharmacy walkthrough").locator("span.truncate", { hasText: /^Pharmacy walkthrough$/ }).click();
    await urlInput.fill(`   ${VIMEO}   `);
    check("editor: padding a saved source isn't an unsaved change", (await P.getByText("Unsaved changes").count()) === 0 && await P.getByText("All changes saved").isVisible());

    const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    const art = JSON.parse(raw);
    const aVideos = [...walk(art.blocks)].filter((b) => b.type === "video");
    check("artifact: video sources trimmed, as authored", JSON.stringify(aVideos.map((b) => b.content)) === JSON.stringify([YOUTUBE, VIMEO, FILE]), JSON.stringify(aVideos.map((b) => b.content)));
    check("artifact: each video has its label, required: false and no description",
      aVideos.every((b) => b.label && b.required === false && !("description" in b)) &&
      JSON.stringify(aVideos.map((b) => b.label)) === JSON.stringify(["Welcome from the team", "Pharmacy walkthrough", "Clinic tour"]));
    check("artifact: the conditional video carries its condition",
      JSON.stringify(noIds(aVideos[2].enableWhen)) === JSON.stringify([{ question: choiceId, operator: "=", answer: "yes" }]) && hasIds(aVideos[2].enableWhen) && aVideos.slice(0, 2).every((b) => !b.enableWhen));
    saveArtifact("builder-video-schema.json", raw);
    await remove(formId);
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const p = browser?.contexts()[0]?.pages()[0]; if (p) await p.screenshot({ path: `${OUT}/video-failure.png` }); } catch {}
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
