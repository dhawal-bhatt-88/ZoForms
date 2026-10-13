// Checkpoint 2: groups in the real editor (Edge), built through the UI.
const fs = require("fs");
const { OUT, API, WEB, PrismaClient, launchBrowser } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url) {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await sleep(1000);
  }
  throw new Error("server not up: " + url);
}

(async () => {
  const email = `verify-gui-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Groups UI" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Medical intake" }) })).json();

    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1100 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("no page errors", false, e.message));

    const cards = page.locator("[data-block-id]");
    const card = (id) => page.locator(`[data-block-id="${id}"]`);
    const alert = page.getByRole("alert").filter({ hasText: /Can't/ });
    const labelInput = page.locator("#block-label");
    /** The id of the card whose label is exactly `label`. */
    const idOf = async (label) => {
      const c = cards.filter({ has: page.locator(`span.font-semibold`, { hasText: new RegExp(`^${label.replace(/[?]/g, "\\?")}$`) }) });
      return c.first().getAttribute("data-block-id");
    };
    const select = async (id) => card(id).locator("span.font-semibold").last().click();
    const order = () => cards.evaluateAll((els) => els.map((e) => `${e.getAttribute("data-depth")}:${e.querySelector("span.font-semibold:last-of-type")?.textContent}`));
    const structure = async () => (await cards.evaluateAll((els) => els.map((e) => {
      // The label is the truncating span; badges share its weight but not this class.
      return `${"  ".repeat(Number(e.getAttribute("data-depth")))}${e.querySelector("span.truncate").textContent}`;
    }))).join(" | ");
    const pick = async (name) => page.getByRole("button", { name, exact: true }).click();
    const addViaInserter = async (name) => { await page.getByTitle("Insert a block").click(); await pick(name); };
    const addToGroup = async (groupLabel, name) => {
      await page.getByRole("button", { name: new RegExp(`^(Add to "${groupLabel}"|"${groupLabel}" is empty)`) }).click();
      await pick(name);
    };
    const rename = async (label) => { await labelInput.fill(label); };
    const deselect = async () => page.locator('input[placeholder="Add a description…"]').click();
    const dismiss = () => page.getByRole("button", { name: "Dismiss" }).click();

    await page.goto(`${WEB}/app/forms/${form.id}/edit`);
    await page.getByText("All changes saved").waitFor();

    // ---------- 1. build a nested form through the UI ----------
    await addViaInserter("Multiple choice");
    await rename("Do you take medication?");
    await page.locator('aside input[value="Option 1"]').fill("Yes");
    await page.locator('aside input[value="Option 2"]').fill("No");
    await deselect();
    await addViaInserter("Group");
    check("adding a group gives it the default label", (await labelInput.inputValue()) === "Untitled group");
    check("an empty group says so, with a way to add to it",
      await page.getByRole("button", { name: /"Untitled group" is empty — add a block to it/ }).isVisible());
    await rename("Medication");
    await addToGroup("Medication", "Short answer"); await rename("Drug name");
    await addToGroup("Medication", "Group"); await rename("Dosage");
    await addToGroup("Dosage", "Number"); await rename("Milligrams");
    await addToGroup("Dosage", "Group"); await rename("Timing");
    await addToGroup("Timing", "Time"); await rename("When do you take it?");
    await deselect();
    await addViaInserter("Group"); await rename("Allergies");
    await addToGroup("Allergies", "Short answer"); await rename("Allergy");
    await deselect();
    await addViaInserter("Short answer"); await rename("Notes");

    const s1 = await structure();
    check("UI builds groups three levels deep, questions inside each",
      s1 === "Do you take medication? | Medication |   Drug name |   Dosage |     Milligrams |     Timing |       When do you take it? | Allergies |   Allergy | Notes", s1);

    const ID = {};
    for (const [k, l] of [["choice", "Do you take medication?"], ["med", "Medication"], ["drug", "Drug name"], ["dosage", "Dosage"], ["mg", "Milligrams"], ["timing", "Timing"], ["time", "When do you take it?"], ["allergies", "Allergies"], ["allergy", "Allergy"], ["notes", "Notes"]]) ID[k] = await idOf(l);

    // ---------- 2. numbering, continuous across groups ----------
    const num = async (id) => (await card(id).locator("span.tabular-nums").count()) ? (await card(id).locator("span.tabular-nums").textContent()) : null;
    const nums = [await num(ID.choice), await num(ID.drug), await num(ID.mg), await num(ID.time), await num(ID.allergy), await num(ID.notes)];
    check("cards numbered 1…6 across groups", JSON.stringify(nums) === JSON.stringify(["1.", "2.", "3.", "4.", "5.", "6."]), nums.join(" "));
    check("groups are not numbered", (await num(ID.med)) === null && (await num(ID.dosage)) === null);

    // ---------- 3. conditions on a group, and the breadcrumb picker ----------
    await select(ID.med);
    // Its only switch is Repeats (contract §12.8); there is no Required one.
    check("inspector calls it a Group, with no help text or required", (await page.locator("aside h4").first().textContent()) === "Group"
      && (await page.locator("aside").getByText("Help text").count()) === 0
      && (await page.locator("aside").getByText("Required", { exact: true }).count()) === 0
      && (await page.locator('aside [role="switch"]').count()) === 1
      && (await page.locator("aside").getByRole("switch", { name: "Repeats" }).count()) === 1);
    check('panel says "Show this group only when…"', await page.getByText("Show this group only when…").isVisible());
    await page.getByRole("button", { name: "Add condition" }).click();
    await page.getByRole("combobox", { name: "Question" }).first().selectOption(ID.choice);
    await page.getByRole("combobox", { name: "operator" }).first().selectOption("=");
    await page.getByRole("combobox", { name: "Answer" }).first().selectOption("Yes");
    check("group gets the Conditional badge", await card(ID.med).getByText("Conditional").isVisible());

    await select(ID.time);
    await page.getByRole("button", { name: "Add condition" }).click();
    const picker = page.getByRole("combobox", { name: "Question" }).first();
    const groupsInPicker = await picker.locator("optgroup").evaluateAll((els) => els.map((g) => `${g.label}: ${[...g.querySelectorAll("option")].map((o) => o.textContent).join(", ")}`));
    const rootOptions = await picker.locator(":scope > option").allTextContents();
    check("picker lists earlier questions in reading order, numbered, with group-path breadcrumbs",
      JSON.stringify(rootOptions) === JSON.stringify(["1. Do you take medication?"])
      && JSON.stringify(groupsInPicker) === JSON.stringify(["Medication: 2. Drug name", "Medication › Dosage: 3. Milligrams"]),
      `root=${rootOptions.join(" | ")} groups=${groupsInPicker.join(" | ")}`);
    await picker.selectOption(ID.mg); // "When do you take it?" shown when Milligrams is answered

    // ---------- 4. screenshots: nested + collapsed, conditional group ----------
    await card(ID.allergies).getByRole("button", { name: /Collapse group "Allergies"/ }).click();
    check("collapsing hides a group's contents and says how many",
      (await card(ID.allergy).count()) === 0 && await card(ID.allergies).getByText("1 block inside").isVisible());
    await deselect();
    await page.screenshot({ path: `${OUT}/cp2-1-nested-collapsed.png` });
    await select(ID.med);
    await page.screenshot({ path: `${OUT}/cp2-2-conditional-group.png` });

    // ---------- 5. refused moves: keyboard and drag ----------
    await select(ID.mg);
    await page.getByRole("combobox", { name: "Move to", exact: true }).selectOption({ label: "Medication › Dosage › Timing" });
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await alert.waitFor({ timeout: 3000 });
    const refused = await alert.innerText();
    check('"Move to group…" that would break a condition is refused, naming the dependent',
      /Can't move "Milligrams" there/.test(refused) && refused.includes("When do you take it? →"), refused);
    await page.screenshot({ path: `${OUT}/cp2-3-refused-move.png` });
    await page.getByRole("button", { name: "When do you take it? →" }).click();
    check("jump link selects the dependent inside nested groups", (await labelInput.inputValue()) === "When do you take it?");
    await dismiss();

    async function dragTo(fromId, toId, dx) {
      const from = card(fromId);
      await from.hover();
      const grip = await from.getByRole("button", { name: "Drag to reorder" }).boundingBox();
      const fromBox = await from.boundingBox();
      const toBox = await card(toId).boundingBox();
      const sx = grip.x + grip.width / 2, sy = grip.y + grip.height / 2;
      // Put the dragged card's centre on the target's centre.
      const ty = toBox.y + toBox.height / 2 + (sy - (fromBox.y + fromBox.height / 2));
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(sx + 8, sy + 2, { steps: 3 });
      await page.mouse.move(sx + dx, ty, { steps: 20 });
      await sleep(200);
      await page.mouse.up();
      await sleep(400);
    }
    const before = await structure();
    await dragTo(ID.choice, ID.allergies, 0); // below Medication, which depends on it
    await alert.waitFor({ timeout: 3000 });
    check("dragging a source below the group that depends on it is refused",
      /Can't move "Do you take medication\?" there/.test(await alert.innerText()) && (await alert.innerText()).includes("Medication →")
      && (await structure()) === before, await alert.innerText());
    await dismiss();

    // ---------- 6. drag into and out of a group ----------
    await card(ID.allergies).getByRole("button", { name: /Expand group "Allergies"/ }).click();
    await dragTo(ID.notes, ID.notes, 34); // one level right, in place: into Allergies
    const into = await structure();
    check("drag right puts a block into the group above it", into.endsWith("Allergies |   Allergy |   Notes"), into);
    await dragTo(ID.notes, ID.notes, -40); // back out
    const out = await structure();
    check("drag left takes it back out of the group", out.endsWith("Allergies |   Allergy | Notes"), out);

    // ---------- 7. keyboard moves ----------
    await card(ID.notes).getByRole("button", { name: "Move up" }).click();
    check("card 'Move up' steps before the group", (await structure()).endsWith("Notes | Allergies |   Allergy"), await structure());
    await card(ID.notes).getByRole("button", { name: "Move down" }).click();
    check("card 'Move down' steps back", (await structure()).endsWith("Allergies |   Allergy | Notes"), await structure());
    await select(ID.drug);
    await page.getByRole("combobox", { name: "Move to", exact: true }).selectOption({ label: "Allergies" });
    await page.getByRole("button", { name: "Move", exact: true }).click();
    const between = await structure();
    check('"Move to group…" moves a question between groups', between.includes("Allergies |   Allergy |   Drug name"), between);
    await select(ID.allergy);
    await page.getByRole("button", { name: "Move up" }).last().click(); // inspector: first in group -> steps out, before it
    check("inspector 'Move up' from the top of a group steps out of it", (await structure()).includes("Allergy | Allergies |   Drug name"), await structure());

    // ---------- 8. delete group: both choices ----------
    await select(ID.notes);
    await page.getByRole("button", { name: "Add condition" }).click();
    await page.getByRole("combobox", { name: "Question" }).first().selectOption(ID.mg); // Notes depends on something inside Medication
    await card(ID.med).getByRole("button", { name: "Delete group" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const dialogText = await dialog.innerText();
    check("delete dialog offers both choices",
      await dialog.getByRole("button", { name: /Group only \(keep questions\)/ }).isVisible()
      && await dialog.getByRole("button", { name: /Group and its questions/ }).isVisible());
    check("keeping questions warns the group's condition will stop applying",
      dialogText.includes("The condition 'Show when Do you take medication? is Yes' will no longer apply to these 2 questions."), dialogText);
    await page.screenshot({ path: `${OUT}/cp2-4-delete-choices.png` });

    await dialog.getByRole("button", { name: /Group and its questions/ }).click();
    await alert.waitFor({ timeout: 3000 });
    const blocked = await alert.innerText();
    check("deleting the group with its questions is refused while something outside depends on it",
      /Can't delete "Medication" and its questions/.test(blocked) && blocked.includes("Notes →") && (await card(ID.med).count()) === 1, blocked);
    await page.screenshot({ path: `${OUT}/cp2-5-delete-with-questions-refused.png` });
    await dismiss();

    await card(ID.med).getByRole("button", { name: "Delete group" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Group only \(keep questions\)/ }).click();
    const unwrapped = await structure();
    check("'Group only' unwraps in place, order kept, contents one level up",
      unwrapped.startsWith("Do you take medication? | Dosage |   Milligrams |   Timing |     When do you take it? | Allergy"), unwrapped);
    check("the group's condition is not copied onto its contents",
      (await card(ID.dosage).getByText("Conditional").count()) === 0 && (await card(ID.mg).getByText("Conditional").count()) === 0);
    await page.screenshot({ path: `${OUT}/cp2-6-after-group-only.png` });

    await card(ID.allergies).getByRole("button", { name: "Delete group" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Group and its questions/ }).click();
    check("deleting a group with its questions works when nothing outside depends on it",
      (await card(ID.allergies).count()) === 0 && (await card(ID.drug).count()) === 0);

    await card(ID.mg).getByRole("button", { name: "Delete", exact: true }).click();
    await alert.waitFor({ timeout: 3000 });
    const leafBlocked = await alert.innerText();
    check("deleting a nested source is refused, naming dependents anywhere",
      leafBlocked.includes("When do you take it? →") && leafBlocked.includes("Notes →"), leafBlocked);
    await dismiss();

    // ---------- 9. save + download ----------
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("All changes saved").waitFor({ timeout: 10000 });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
    const art = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    const dosage = art.blocks[1];
    check("saved and downloaded as schemaVersion 2 with nested groups",
      art.schemaVersion === 2 && dosage.type === "group" && dosage.blocks[1].type === "group"
      && dosage.blocks[1].blocks[0].enableWhen?.[0]?.question === ID.mg,
      JSON.stringify(art).slice(0, 300));
    fs.writeFileSync(`${OUT}/cp2-artifact.json`, JSON.stringify(art, null, 2));
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const pages = browser?.contexts()[0]?.pages(); if (pages?.[0]) await pages[0].screenshot({ path: `${OUT}/cp2-failure.png` }); } catch {}
  } finally {
    if (browser) await browser.close();
    const u = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    if (u) {
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
