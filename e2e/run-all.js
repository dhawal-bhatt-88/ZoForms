// Runs the suites one after another (they share one database and dev server, so
// not in parallel) and prints a summary. Pass suite names to run only those:
//   node e2e/run-all.js                 # all of them
//   node e2e/run-all.js pages-ui drafts # verify-pages-ui.js and verify-drafts-builder.js
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const all = fs.readdirSync(__dirname).filter((f) => /^verify-.+\.js$/.test(f)).sort();
const wanted = process.argv.slice(2);
const suites = wanted.length ? all.filter((f) => wanted.some((w) => f.includes(w))) : all;
if (!suites.length) {
  console.error(`No suite matches ${wanted.join(", ")}. Available: ${all.join(", ")}`);
  process.exit(2);
}

const summary = [];
for (const file of suites) {
  console.log(`\n== ${file}`);
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  process.stdout.write(output.split("\n").filter((l) => /FAIL|passed/.test(l)).join("\n") + "\n");
  const tally = output.match(/(\d+)\/(\d+) passed/);
  summary.push({ file, ok: run.status === 0, tally: tally ? tally[0] : "no result", secs: Math.round((Date.now() - started) / 1000) });
}

console.log("\nSummary");
for (const s of summary) console.log(`  ${s.ok ? "PASS" : "FAIL"}  ${s.file.padEnd(28)} ${s.tally.padEnd(14)} ${s.secs}s`);
process.exit(summary.every((s) => s.ok) ? 0 : 1);
