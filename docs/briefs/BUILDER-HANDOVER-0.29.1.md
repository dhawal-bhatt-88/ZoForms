# Builder hand-over — `@zoworkhq/zoforms` 0.29.1

**Nothing changed except line endings.** No code, behaviour, schema, payload, API, exported name, class, data attribute, custom property, storage name or console message differs from 0.29.0. Every text file in the renderer repo, and so every file in the tarball, is now LF, so the same commit packs to the same bytes on every machine.

**Take the tarball:** `zoworkhq-zoforms-0.29.1.tgz`, SHA-256 `7385db4babb7c37e4748978a35ac36ab8575de5a4bf8b9e84f5cb5f4da14fd06`.

## Why

Git on Windows converts text files to CRLF on checkout (`core.autocrlf=true` is the Git for Windows default), and `npm pack` packs the bytes on disk. So 0.29.0 packed differently depending on where it was packed: the clean-checkout tarball (`3f3751d1…b070`, the one in the 0.29.0 hand-over) carries a README with CRLF line endings. Its JavaScript, types and CSS behave the same either way.

0.29.1 pins every text file to LF in `.gitattributes`, which overrides `core.autocrlf`. Two fresh clones of the release commit, one with `core.autocrlf=true` (a Windows laptop) and one with `core.autocrlf=false` (a Linux CI runner), each ran `npm ci`, the build and `npm pack`. Both produced the SHA-256 above, the same as the tarball packed in the working repo. Unpacked, none of its 12 files (README, LICENSE, `package.json`, and every `.js`, `.cjs`, `.d.ts`, `.d.cts` and `.css` in `dist`) contains a CR byte.

## 1. Replace the vendored tarball

In both the web app and the API:

1. `npm uninstall @zoworkhq/zoforms`, and delete `zoworkhq-zoforms-0.29.0.tgz` if nothing else uses it.
2. `npm install ./zoworkhq-zoforms-0.29.1.tgz`. Check that `node_modules/@zoworkhq/zoforms/package.json` says `0.29.1`.
3. Clear the bundler cache (for Vite, delete `node_modules/.vite`), then restart the dev server and the API.

No import, code or test changes are needed.

## 2. The contracts are unchanged

Both are byte-for-byte the same as in 0.29.0, and both were already LF:

| File | SHA-256 (LF) |
|---|---|
| `docs/DRAFTS-CONTRACT.md` | `821ba48e059e100b13beba8b6400ae031ffa07273c9acc5977c5443d75e57167` |
| `docs/GROUPS-AND-PAGES-CONTRACT.md` | `190056d911d4312962c02cd5b8a90e96dccb855a4228be818264e84101a54fd7` |

If your copies hash differently, check whether your checkout turned them into CRLF before suspecting the content. The `.gitattributes` below stops that from happening.

## 3. Match the renderer's `.gitattributes` (recommended)

The renderer repo's `.gitattributes` is now exactly this. The two contract-only `eol=lf` lines it used to have are covered by the first rule:

```gitattributes
# Every text file is LF in the index and on disk, on every machine,
# so `npm pack` gives the same bytes from the same commit.
* text=auto eol=lf

# Binary: never convert line endings
*.png   binary
*.jpg   binary
*.jpeg  binary
*.gif   binary
*.webp  binary
*.ico   binary
*.woff  binary
*.woff2 binary
*.ttf   binary
*.otf   binary
*.wav   binary
*.mp3   binary
*.mp4   binary
*.webm  binary
*.tgz   binary
*.gz    binary
*.zip   binary
*.pdf   binary
```

To adopt it in the builder repo:

1. Add binary lines for any other binary types the repo tracks (`git ls-files --eol` shows them as `i/-text`). Keep `eol=crlf` for any file that needs it, such as `*.bat` or `*.cmd`.
2. Commit the `.gitattributes` on its own.
3. Run `git add --renormalize .`. If it stages anything, check that `git diff --cached --ignore-cr-at-eol --stat` shows no changes, then commit that separately as line endings only.
4. With a clean tree (`git status` empty), refresh the files on disk: `git rm -r --cached -q . && git reset --hard`. Ignored files such as `node_modules` and `dist` aren't touched.
5. `git ls-files --eol`: every text file should show `i/lf w/lf`.

## Renderer commits

On the renderer repo's working branch, not pushed:

- `384483c` `.gitattributes`. `git add --renormalize .` then staged nothing, because every file was already LF in the index. Only the files on disk were CRLF.
- `c35bc7d` 0.29.1: version bump and the README release note.
