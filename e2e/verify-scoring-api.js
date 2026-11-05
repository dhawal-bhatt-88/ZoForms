// Scoring (contract §17) through the real API and database: the formula text
// stored exactly, and only the text — the save derives and checks the tree, and
// the download carries it; a tree sent by the client ignored; text generated for
// a tree sent without text; score ids filled and kept; question names generated
// at save from labels; the 300-term limit (text and tree), with a 300-term
// formula nested 5 groups deep downloaded and checked by the external app's
// installed @zoworkhq/zoforms (assertSchemaIntegrity, calculateScores); every
// save-time rejection with its message (naming the group and the score, or the
// question); the downloaded artifact (scores and option scores, no names or
// formula text); group templates; restoring a version.
const path = require("path");
const { pathToFileURL } = require("url");
const { API, PrismaClient, RENDERER_CORE } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

const LABELS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];
const CODES = ["not_at_all", "several_days", "more_than_half", "nearly_every_day"];
/** A PHQ-style item, its options scored 0–3 unless `scores` says otherwise (undefined = no score). */
const item = (id, label, name, scores = [0, 1, 2, 3]) => ({
  id, type: "choice", label, ...(name ? { name } : {}),
  options: LABELS.map((l, i) => ({ code: CODES[i], label: l, ...(scores[i] === undefined ? {} : { score: scores[i] }) })),
});
const score = (formulaText, extra = {}) => ({ id: "total", label: "Total score", formulaText, unanswered: "no-score", ...extra });

// A scored group with four items (two in a nested plain group), a number, a
// short-text question, a ranking, a matrix and a nested repeat; a question outside.
const valid = () => ({
  title: "Scoring API verify",
  blocks: [
    { id: "phq", type: "group", label: "PHQ-4", scores: [
      score("q1 + q2 + q3 + q4"),
      { id: "weighted", label: "Weighted", formulaText: "(q1 + Q2) * days / 7", unanswered: "zero", decimals: 2, showToRespondent: true },
    ], blocks: [
      item("b1", "Little interest", "q1"),
      item("b2", "Feeling down", "q2"),
      { id: "more", type: "group", label: "More", blocks: [
        item("b3", "Trouble sleeping", "q3"),
        item("b4", "Feeling tired", "q4"),
        { id: "days", type: "number", label: "Days affected", name: "days" },
        { id: "note", type: "short", label: "Anything else?", name: "note" },
      ] },
      { id: "rank", type: "ranking", label: "Rank these", name: "rank", options: [{ code: "a", label: "A", score: 1 }, { code: "b", label: "B" }] },
      { id: "mx", type: "matrix", label: "Mood grid", name: "mx",
        options: [{ code: "am", label: "Morning", score: 5 }, { code: "pm", label: "Evening" }],
        columns: [{ code: "low", label: "Low", score: 0 }, { code: "high", label: "High", score: 1 }] },
      { id: "visits", type: "group", label: "Visits", repeats: true, repeatLabel: "visit", minOccurs: 0, blocks: [
        { id: "count", type: "number", label: "Count", name: "count" },
      ] },
    ] },
    { id: "after", type: "number", label: "Outside", name: "outside" },
  ],
});
const G = 'Group "PHQ-4", score "Total score"';
/** The form with the first score replaced (or the scores list, given an array or anything else). */
const withScores = (scores) => {
  const s = valid();
  s.blocks[0].scores = scores;
  return s;
};
const withTotal = (total) => withScores([total]);
const find = (blocks, id) => {
  for (const b of blocks) {
    if (b.id === id) return b;
    const inner = b.blocks && find(b.blocks, id);
    if (inner) return inner;
  }
};
const R = (id) => ({ ref: id });
const op = (o, a, b) => ({ op: o, args: [a, b] });
/** A left-nested sum of `terms` references, alternating b1 and b2. */
const longTree = (terms) => {
  let t = R("b1");
  for (let k = 1; k < terms; k += 1) t = op("+", t, R(k % 2 ? "b2" : "b1"));
  return t;
};
const longText = (terms) => Array.from({ length: terms }, (_, k) => (k % 2 ? "q2" : "q1")).join(" + ");
/** True when no score anywhere in `blocks` holds a formula tree: stored content keeps text only. */
const noFormulaKey = (blocks) => (blocks ?? []).every((b) =>
  (Array.isArray(b.scores) ? b.scores.every((x) => typeof x !== "object" || x === null || !("formula" in x)) : true) && noFormulaKey(b.blocks));

(async () => {
  const email = `verify-scoring-api-${Date.now()}@example.test`;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Scoring" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const call = async (method, path, body) => {
      const r = await fetch(API + path, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      let json;
      try { json = JSON.parse(text); } catch {}
      return { status: r.status, text, json };
    };
    const form = (await call("POST", "/v1/forms", { title: "Scoring" })).json;
    const put = (schema) => call("PUT", `/v1/forms/${form.id}/schema`, schema);
    const stored = async () => (await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } })).schema;
    const rows = () => prisma.formVersion.count({ where: { formId: form.id } });
    const short = (r) => `${r.status} ${r.text.slice(0, 300)}`;

    // ---------- save: the text is the source of truth ----------
    let r = await put(valid());
    check("a form with two scores saves (200)", r.status === 200, short(r));
    const firstVersionId = r.json?.versionId;
    let s = await stored();
    let [total, weighted] = find(s.blocks, "phq").scores;
    const download = async () => JSON.parse((await call("GET", `/v1/forms/${form.id}/artifact`)).text);
    check("stored: formulaText exactly as sent", total.formulaText === "q1 + q2 + q3 + q4" && weighted.formulaText === "(q1 + Q2) * days / 7");
    check("the save derives and checks the tree, and the stored content holds text only: no formula key stored",
      noFormulaKey(s.blocks), JSON.stringify(find(s.blocks, "phq").scores));
    let derived = find((await download()).blocks, "phq").scores.map((x) => x.formula);
    check("the download carries the tree derived from the text, left to right, * and / before + and -",
      JSON.stringify(derived[0]) === JSON.stringify(op("+", op("+", op("+", R("b1"), R("b2")), R("b3")), R("b4")))
      && JSON.stringify(derived[1]) === JSON.stringify(op("/", op("*", op("+", R("b1"), R("b2")), R("days")), { num: 7 })),
      JSON.stringify(derived));
    check("stored: the score settings as sent", total.unanswered === "no-score" && weighted.unanswered === "zero" && weighted.decimals === 2 && weighted.showToRespondent === true);
    check("stored: option scores kept", find(s.blocks, "b1").options.map((o) => o.score).join() === "0,1,2,3" && find(s.blocks, "mx").columns.map((o) => o.score).join() === "0,1");
    check("the response carries the stored content: text, no trees", noFormulaKey(r.json.schema.blocks) && r.json.schema.blocks[0].scores[0].formulaText === "q1 + q2 + q3 + q4");

    const sentTree = withScores([score("q1 + q2", { formula: R("after") })]);
    r = await put(sentTree);
    s = await stored();
    derived = find((await download()).blocks, "phq").scores[0].formula;
    check("a tree sent with text is ignored: none stored, and the download's tree is the text's",
      r.status === 200 && noFormulaKey(s.blocks) && JSON.stringify(derived) === JSON.stringify(op("+", R("b1"), R("b2"))), `${short(r)} ${JSON.stringify(derived)}`);
    r = await put(withScores([score("q1 + q2", { formula: R("b4") })]));
    check("re-sending the same text with a different tree is no change (409 NO_CHANGES)", r.status === 409 && r.json?.code === "NO_CHANGES", short(r));

    // ---------- a tree without text (created through the API) ----------
    const treeOnly = { label: "Total score", formula: op("*", op("+", R("b1"), R("b2")), op("-", R("days"), { num: -2 })), unanswered: "no-score" };
    r = await put(withScores([treeOnly]));
    s = await stored();
    total = find(s.blocks, "phq").scores[0];
    check("a score with a tree but no text saves (200)", r.status === 200, short(r));
    check("…and gets text from the tree: names, single spaces, brackets only where needed, (0 - n) for a negative",
      total.formulaText === "(q1 + q2) * (days - (0 - 2))", total.formulaText);
    derived = find((await download()).blocks, "phq").scores[0].formula;
    check("…the tree itself isn't stored, and the download carries the tree that text gives", !("formula" in total) && JSON.stringify(derived)
      === JSON.stringify(op("*", op("+", R("b1"), R("b2")), op("-", R("days"), op("-", { num: 0 }, { num: 2 })))), JSON.stringify(derived));
    check("…and keeps the id the same score already has (same position, same label)", total.id === "total", total.id);
    r = await put(withScores([treeOnly, { label: "Second", formulaText: "q3", unanswered: "zero" }]));
    s = await stored();
    const filledId = find(s.blocks, "phq").scores[1].id;
    check("a new score sent without an id gets one at save", r.status === 200 && /^s_[0-9a-z]{8}$/.test(filledId), `${short(r)} ${filledId}`);
    r = await put(withScores([treeOnly, { label: "Second", formulaText: "q3", unanswered: "zero" }]));
    check("re-sent without their ids: each keeps the id it has (409 NO_CHANGES)", r.status === 409 && r.json?.code === "NO_CHANGES", short(r));
    r = await put(withScores([treeOnly, { label: "Renamed", formulaText: "q3", unanswered: "zero" }]));
    s = await stored();
    check("a different score at that position gets a new id", r.status === 200 && find(s.blocks, "phq").scores[1].id !== filledId, short(r));

    // ---------- names (§17.8) ----------
    const unnamed = valid();
    const g = unnamed.blocks[0];
    g.blocks.push(
      item("b5", "Little interest or pleasure in doing things", undefined),
      item("b6", "Multiple choice", undefined),
      { ...item("b7", "焦虑", undefined) },
    );
    delete find(unnamed.blocks, "note").name;
    r = await put(unnamed);
    s = await stored();
    check("names generated at save from labels",
      r.status === 200 && find(s.blocks, "b5").name === "little_interest_or_pleasure_in" && find(s.blocks, "b6").name === "multiple_choice"
      && find(s.blocks, "note").name === "anything_else", short(r) + " " + JSON.stringify(["b5", "b6", "note"].map((id) => find(s.blocks, id)?.name)));
    check("an unusable label gives q{n}, the question's number", find(s.blocks, "b7").name === "q12", find(s.blocks, "b7").name);
    const clash = valid();
    clash.blocks[0].blocks.push(item("b8", "Q1", undefined));
    r = await put(clash);
    s = await stored();
    check("a generated name avoids the names taken: q1 → q1_2", r.status === 200 && find(s.blocks, "b8").name === "q1_2", short(r));
    check("a question outside every scored group's reach keeps its name, unchecked", find(s.blocks, "after").name === "outside" && find(s.blocks, "count").name === "count");

    // ---------- the 300-term limit (§17.7) ----------
    const TOO_LONG = `${G}: This formula is too long. Use at most 300 question names and numbers.`;
    for (const terms of [299, 300, 301]) {
      r = await put(withTotal(score(longText(terms))));
      check(`text with ${terms} terms: ${terms <= 300 ? "saves (200), text only" : "400, too long"}`,
        terms <= 300 ? r.status === 200 && noFormulaKey((await stored()).blocks) : r.status === 400 && r.json.message === TOO_LONG, short(r));
      // The same formula as a tree: it becomes the same text, so the save is no change (409).
      r = await put(withTotal({ id: "total", label: "Total score", formula: longTree(terms), unanswered: "no-score" }));
      const ok = terms <= 300 ? r.status === 409 && r.json?.code === "NO_CHANGES" : r.status === 400 && r.json.message === TOO_LONG;
      check(`a tree without text with ${terms} terms: ${terms <= 300 ? "becomes the same text (409 NO_CHANGES)" : "400, too long"}`, ok, short(r));
    }
    r = await put(withTotal(score("q1")));
    r = await put(withTotal({ id: "total", label: "Total score", formula: longTree(300), unanswered: "no-score" }));
    s = await stored();
    check("a 300-term tree without text saves (200) as its text, with no tree stored",
      r.status === 200 && find(s.blocks, "phq").scores[0].formulaText === longText(300) && noFormulaKey(s.blocks), short(r));

    // A 300-term formula nested 5 groups deep: downloaded, then checked by the renderer.
    {
      const deepForm = (await call("POST", "/v1/forms", { title: "Deep" })).json;
      let group = { id: "deep", type: "group", label: "Deep score",
        scores: [{ id: "sum", label: "Sum", formulaText: Array.from({ length: 300 }, (_, k) => (k % 2 ? "b" : "a")).join(" + "), unanswered: "no-score" }],
        blocks: [{ id: "qa", type: "number", label: "A", name: "a" }, { id: "qb", type: "number", label: "B", name: "b" }] };
      for (let k = 0; k < 5; k += 1) group = { id: `wrap${k}`, type: "group", label: `Wrap ${k}`, blocks: [group] };
      r = await call("PUT", `/v1/forms/${deepForm.id}/schema`, { title: "Deep", blocks: [group] });
      check("300 terms, nested 5 groups deep: saves (200)", r.status === 200, short(r));
      const dl = await call("GET", `/v1/forms/${deepForm.id}/artifact`);
      check("…downloads (200)", dl.status === 200, short(dl));
      let deepArtifact;
      try { deepArtifact = JSON.parse(dl.text); } catch (e) { check("…the download is JSON", false, e.message); }
      let core;
      try { core = await import(pathToFileURL(RENDERER_CORE).href); } catch (e) { check("…the external app's @zoworkhq/zoforms loads", false, e.message); }
      if (deepArtifact && core) {
        const version = require(path.join(path.dirname(RENDERER_CORE), "../../package.json")).version;
        // Scores need 0.23.0 or later. Only the core is called here, with no class names, so not the zf- minimum.
        const [maj, min] = version.split(".").map(Number);
        check("…checked with the external app's @zoworkhq/zoforms, 0.23.0 or later", maj > 0 || min >= 23, version);
        let integrity = null;
        try { core.assertSchemaIntegrity(deepArtifact); } catch (e) { integrity = e.message; }
        check("…assertSchemaIntegrity passes", integrity === null, integrity);
        const results = core.calculateScores(deepArtifact, { qa: { state: "answered", value: 2 }, qb: { state: "answered", value: 3 } });
        check("…calculateScores gives 150 × 2 + 150 × 3 = 750",
          results.length === 1 && results[0].groupId === "deep" && results[0].scoreId === "sum" && results[0].value === 750, JSON.stringify(results));
        const unanswered = core.calculateScores(deepArtifact, { qa: { state: "answered", value: 2 } });
        check("…and no score with one question unanswered (no-score)", unanswered[0]?.value === null && unanswered[0]?.reason === "unanswered", JSON.stringify(unanswered));
      }
    }

    // ---------- the artifact ----------
    r = await put(valid());
    check("back to the valid form (200)", r.status === 200, short(r));
    r = await call("GET", `/v1/forms/${form.id}/artifact`);
    const art = JSON.parse(r.text);
    const phq = find(art.blocks, "phq");
    check("download: 200", r.status === 200, short(r));
    check("download: scores with id, label, formula, unanswered, decimals, showToRespondent",
      JSON.stringify(phq.scores) === JSON.stringify([
        { id: "total", label: "Total score", formula: op("+", op("+", op("+", R("b1"), R("b2")), R("b3")), R("b4")), unanswered: "no-score" },
        { id: "weighted", label: "Weighted", formula: op("/", op("*", op("+", R("b1"), R("b2")), R("days")), { num: 7 }), unanswered: "zero", decimals: 2, showToRespondent: true },
      ]), JSON.stringify(phq.scores));
    check("download: option scores on choices and a matrix's columns",
      find(art.blocks, "b3").options.map((o) => o.score).join() === "0,1,2,3" && find(art.blocks, "mx").columns.map((o) => o.score).join() === "0,1");
    check("download: no score where it means nothing (a matrix's rows, a ranking)",
      find(art.blocks, "mx").options.every((o) => !("score" in o)) && find(art.blocks, "rank").options.every((o) => !("score" in o)));
    check("download: no name and no formulaText anywhere", !r.text.includes('"name"') && !r.text.includes("formulaText"));
    // What respondents get is the download, rendered in the client's app: never the builder-only names or formula text.
    const sent = await call("GET", `/v1/forms/${form.id}/artifact`);
    check("what respondents get (the download) has scores but no names or formula text",
      sent.status === 200 && sent.text.includes('"scores"') && !sent.text.includes('"name"') && !sent.text.includes("formulaText"), `${sent.status}`);

    // ---------- every rejection names the group and the score, or the question ----------
    const before = await rows();
    const exact = (m) => new RegExp(`^${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
    const withQuestion = (id, patch) => {
      const x = valid();
      Object.assign(find(x.blocks, id), patch);
      return x;
    };
    const tree = (formula) => withTotal({ id: "total", label: "Total score", formula, unanswered: "no-score" });
    const cases = [
      // §17.7: the formula text, word for word.
      ["empty formula", withTotal(score("")), exact(`${G}: Enter a formula, e.g. q1 + q2.`)],
      ["a character that isn't allowed", withTotal(score("q1 % q2")), exact(`${G}: "%" isn't allowed. Use question names, numbers, + - * / and brackets.`)],
      ["a missing operator", withTotal(score("2 q1")), exact(`${G}: Add an operator between 2 and q1.`)],
      ["a missing operand", withTotal(score("q1 +")), exact(`${G}: Add a name or number after +.`)],
      ["a unary minus", withTotal(score("-q1")), exact(`${G}: Start with a question name, a number or a bracket.`)],
      ["empty brackets", withTotal(score("q1 + ()")), exact(`${G}: Brackets can't be empty.`)],
      ["an unclosed bracket", withTotal(score("(q1 + q2")), exact(`${G}: A bracket isn't closed.`)],
      ["a stray closing bracket", withTotal(score("q1 + q2)")), exact(`${G}: There's a closing bracket without an opening one.`)],
      ["a name outside the group", withTotal(score("q1 + outside")), exact(`${G}: There's no question named "outside" in this group.`)],
      ["a name in a nested repeat", withTotal(score("q1 + count")), exact(`${G}: "count" is in a repeating group, so this score can't use it.`)],
      ["a name of a type that can't be scored", withTotal(score("q1 + note")),
        exact(`${G}: "note" can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`)],
      ["a ranking (can't be scored)", withTotal(score("rank")),
        exact(`${G}: "rank" can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`)],
      ["no names", withTotal(score("1 + 2")), exact(`${G}: Use at least one question name.`)],
      // Decision C: a referenced question saved as short text.
      ["a referenced question changed to short text", withQuestion("b1", { type: "short", options: undefined }),
        exact(`${G}: "q1" can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions. (+1 more)`)],
      // §17.6: the score's own fields.
      ["an id outside the pattern", withTotal(score("q1", { id: "bad id" })),
        exact(`${G}: Its id "bad id" isn't allowed. An id is up to 64 letters, numbers, ".", "_" and "-", starting with a letter or number.`)],
      ["a duplicate id", withScores([score("q1"), score("q2", { label: "Other" })]),
        exact(`Group "PHQ-4", score "Other": Its id "total" is also used by score 1. Score ids must be unique within a group.`)],
      ["a blank label", withTotal(score("q1", { label: " " })), exact(`Group "PHQ-4", score 1: It needs a label.`)],
      ["an unknown unanswered", withTotal(score("q1", { unanswered: "skip" })), exact(`${G}: Its unanswered setting must be "no-score" or "zero", not "skip".`)],
      ["a missing unanswered", withTotal({ id: "total", label: "Total score", formulaText: "q1" }), exact(`${G}: Its unanswered setting must be "no-score" or "zero", not missing.`)],
      ["decimals above 4", withTotal(score("q1", { decimals: 5 })), exact(`${G}: Its decimal places must be a whole number from 0 to 4.`)],
      ["decimals not whole", withTotal(score("q1", { decimals: 0.5 })), exact(`${G}: Its decimal places must be a whole number from 0 to 4.`)],
      ["showToRespondent not a boolean", withTotal(score("q1", { showToRespondent: "yes" })), exact(`${G}: Its showToRespondent setting must be true or false.`)],
      ["a score that isn't an object", withScores(["q1"]), exact(`Group "PHQ-4", score 1: It must be an object with a label, a formula and how to treat unanswered questions.`)],
      ["scores that aren't a list", withScores({ total: "q1" }), exact(`Group "PHQ-4": Its scores must be a list.`)],
      ["scores on a page", { title: "P", blocks: [{ id: "p1", type: "page", title: "One", scores: [score("x")], blocks: [{ id: "x", type: "number", label: "X", name: "x" }] }] },
        exact(`Page "One": a page can't have scores — only groups can. Put its questions in a group on the page and score that instead.`)],
      // §17.6: a tree sent without text.
      ["a malformed node", tree({ num: 1, ref: "b1" }), exact(`${G}: Its formula isn't valid: every part must be an object with a num, a ref, or an op and its args.`)],
      ["a num that isn't a number", tree(op("+", R("b1"), { num: "2" })), exact(`${G}: Its formula isn't valid: "2" isn't a finite number.`)],
      ["an op outside + - * /", tree(op("^", R("b1"), { num: 2 })), exact(`${G}: Its formula isn't valid: "^" isn't one of + - * /.`)],
      ["args not exactly two", tree({ op: "+", args: [R("b1")] }), exact(`${G}: Its formula isn't valid: an operator needs exactly two args.`)],
      ["a ref to no block", tree(R("nope")), exact(`${G}: Its formula uses "nope", which isn't the id of a question in this form.`)],
      ["a ref outside the group", tree(R("after")), exact(`${G}: Its formula uses "Outside", which isn't a question in this group.`)],
      ["a ref into a nested repeat", tree(R("count")), exact(`${G}: Its formula uses "Count", which is in a repeating group, so this score can't use it.`)],
      ["a ref to a type that can't be scored", tree(R("note")),
        exact(`${G}: Its formula uses "Anything else?", which can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`)],
      // §17.6: option scores.
      ["a referenced choice with an option without a score", withQuestion("b2", { options: item("b2", "x", "q2", [0, 1, undefined, 3]).options }),
        exact(`Block "PHQ-4 › Feeling down": Option 3 ("More than half the days") has no score, but the score "Total score" of "PHQ-4" uses this question. Give every option a score.`)],
      ["a referenced matrix with a column without a score", (() => {
        const x = withTotal(score("q1 + mx"));
        find(x.blocks, "mx").columns[1] = { code: "high", label: "High" };
        return x;
      })(), exact(`Block "PHQ-4 › Mood grid": Column 2 ("High") has no score, but the score "Total score" of "PHQ-4" uses this question. Give every column a score.`)],
      ["an option score that isn't a number", withQuestion("b1", { options: [{ code: "a", label: "A", score: "1" }, ...item("b1", "x", "q1").options.slice(1)] }),
        exact(`Block "PHQ-4 › Little interest": the score of option 1 ("A") must be a number.`)],
      // §17.8: names.
      ["a name outside the pattern", withQuestion("note", { name: "Note!" }),
        exact(`Block "PHQ-4 › More › Anything else?": Its name "Note!" isn't allowed. A name starts with a lower-case letter and uses only a–z, 0–9 and "_", up to 64 characters.`)],
      ["a name used twice in one reach", withQuestion("note", { name: "days" }),
        exact(`Block "PHQ-4 › More › Anything else?": Its name "days" is also used by "Days affected", and the scores of "PHQ-4" can use both. Give each question its own name.`)],
    ];
    for (const [name, payload, re] of cases) {
      const res = await put(payload);
      const msg = res.json?.message;
      check(`400: ${name}`, res.status === 400 && re.test(msg), `${res.status} ${msg}`);
    }
    check("rejected saves created no versions", (await rows()) === before);

    // ---------- group templates ----------
    const content = clone(valid().blocks[0]);
    content.scores = [score("q1 + q2 + q3 + q4", { formula: R("b9") })];
    r = await call("POST", "/v1/templates", { kind: "group", name: "PHQ-4", content });
    const tpl = r.json && await prisma.template.findUnique({ where: { id: r.json.id } });
    check("a group template with a score saves (201): its text kept, the tree sent ignored, nothing stored but text",
      r.status === 201 && r.json.content.scores[0].formulaText === "q1 + q2 + q3 + q4" && noFormulaKey([r.json.content]) && !!tpl && noFormulaKey([tpl.content]), short(r));
    const badTpl = clone(valid().blocks[0]);
    badTpl.scores = [score("q1 + outside")];
    r = await call("POST", "/v1/templates", { kind: "group", name: "Bad", content: badTpl });
    check("a group template with a formula error is refused (400), naming the group and the score",
      r.status === 400 && r.json.message === `${G}: There's no question named "outside" in this group.`, short(r));

    // ---------- restore ----------
    r = await put(withTotal(score("q1")));
    r = await call("POST", `/v1/forms/${form.id}/versions/${firstVersionId}/restore`);
    s = await stored();
    check("restoring the first saved version brings its scores back, text only",
      r.status === 201 && find(s.blocks, "phq")?.scores.length === 2 && noFormulaKey(s.blocks), short(r));
    check("no stored version of this form holds a formula tree",
      (await prisma.formVersion.findMany({ where: { formId: form.id } })).every((v) => noFormulaKey(v.schema.blocks)));
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
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
