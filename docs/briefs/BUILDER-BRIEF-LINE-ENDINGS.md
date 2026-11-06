# Builder brief — force LF line endings and vendor renderer 0.29.1

Builder repo (ZoForms), branch `main`.

**Run after** the renderer has been repacked as 0.29.1. Dhawal will copy in `zoworkhq-zoforms-0.29.1.tgz` and `BUILDER-HANDOVER-0.29.1.md` from the renderer repo.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-LINE-ENDINGS.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing anything else.**

## Why

Git on this Windows machine converts text files to CRLF on checkout. 20 web unit tests compare text exactly, so they fail on a normal Windows checkout even at untouched HEAD, and pass only on an LF checkout. The renderer's 0.29.0 tarball also carried a CRLF README, which is why the README-sync test was made to ignore line endings. Both problems have one cause; this brief removes it.

Today only the two contracts are pinned to LF in `.gitattributes`. This brief pins every text file.

## What to do

1. **`.gitattributes`** at the repo root:
   - `* text=auto eol=lf` as the first rule.
   - Explicit `binary` for binary types the repo holds (at least `*.tgz`, images, fonts; CP0 lists what exists).
   - Keep any file that genuinely needs CRLF (e.g. `*.bat`, `*.cmd`) as `eol=crlf`; CP0 lists any.
   - The existing contract lines can be folded into the general rule or kept; CP0 proposes which.
2. **Renormalise** in a commit of its own: `git add --renormalize .`. The commit must contain line-ending changes only: `git diff --cached --ignore-cr-at-eol --stat` must show nothing changed.
3. **Refresh the working tree** so files on disk are LF too. Only with a clean tree (`git status` empty); if anything is uncommitted, stop and report. Check with `git ls-files --eol` that every text file shows `i/lf` and `w/lf`.
4. **Vendor 0.29.1:** check the tarball's SHA-256 and both contracts' SHA-256s against the hand-over before using them. Remove the 0.29.0 tarball, update both `package.json` references and the lockfile, and regenerate the `*.types.json` and `renderer-sources.json` files from the new tarball.
5. **README-sync test:** restore the strict comparison (line endings included) now that the tarball's README is LF, so a future CRLF tarball is caught (decision 1).
6. **Run on the Windows checkout itself**, not a separate LF clone: all web, form-schema and API unit tests, all web specs, every root e2e suite, the contrast gate and axe. The 20 tests that failed before must now pass here.

## Decisions for Dhawal (CP0 lists them again)

1. **README-sync test:** restore strict comparison (recommended), or keep ignoring line endings.

## Rules

- No code changes beyond the README-sync test and the vendoring. If any other test needs changing because of line endings, report it first.
- Both contracts' SHA-256s must stay `821ba48e…7e57167` (Drafts) and `190056d9…4fd7` (Groups and Pages).
- Every test keeps passing. Commit at each checkpoint once tests pass. Don't push.
- Stop any servers you start before finishing.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Current `.gitattributes`, the local `core.autocrlf` value, and whether an `.editorconfig` exists and what it says about line endings.
- `git ls-files --eol` summary: how many files are `i/crlf`, `i/lf`, `i/mixed`, and which.
- Binary types present, and any file that needs CRLF.
- The 20 tests that fail on this checkout today, by name.
- The proposed `.gitattributes` content and your answer to decision 1.

**CP1 — Line endings.** Steps 1–3; the 20 tests now pass on this checkout.

**CP2 — Renderer 0.29.1.** Steps 4–6; report the full test and e2e results.
