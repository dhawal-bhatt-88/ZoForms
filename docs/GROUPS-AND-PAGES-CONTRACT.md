# Groups and Pages — Schema Contract

Status: agreed 25 Sep 2026. Shared by the builder repo and the `@yourco/forms` renderer repo.
Both implementations must follow this file exactly. Change it here first, then in both repos.

## 1. Shapes

```ts
// Group — any depth, at the root or inside a page/group
{ id: string; type: "group"; label: string;
  enableWhen?: EnableWhenCondition[]; enableBehavior?: "any";
  blocks: Block[] }

// Page — root level only
{ id: string; type: "page"; title: string;
  enableWhen?: EnableWhenCondition[]; enableBehavior?: "any";
  blocks: Block[] }

// Form level (new, optional)
navigation?: {
  showProgress?: boolean;               // default true
  progressStyle?: "caption" | "bar";    // default "caption"; used only when showProgress is true
  reviewPage?: boolean;                 // default false
}
```

- The children field is `blocks`, the same name as the form's root array.
- `enableWhen` / `enableBehavior` have the existing contract. The builder stores only `"any"`; absent means all. The renderer also accepts an explicit `"all"`.
- No `mode` field: a form is **paged if and only if its root contains pages**.
- The page `title` is the wizard step name. There is no separate step-name field.
- `navigation` is ignored when the form is not paged.
- `schemaVersion` becomes **2**. The first renderer release with groups (0.5.0) and later accept 1 and 2 (v1 = v2 without groups/pages). All integrity checks in section 6 apply to v1 schemas too.
- Groups and pages have no value, no `required`, no `completeRequired`.

## 2. Structure rules

1. Groups nest to **any depth**. There is no depth limit.
2. `page` may appear only at the root — never inside a group or another page.
3. If any root item is a page, **every** root item must be a page (no mixed root).
4. Block ids are unique across the whole tree, including group and page ids.
5. `label` (group) and `title` (page) are required and non-blank. The builder defaults them to "Untitled group" / "Untitled page".
6. Empty group or page (`blocks: []`): **builder rejects at save**; **renderer renders nothing** for it (does not throw).
7. **Effectively empty:** a group or page with no *displayable* descendant — every descendant is hidden by conditions, or is a `hidden`-type block, a `text` block with blank `content`, an `image` block without a valid source (see §9), or a `video` block without a recognised source (see §10) — is treated as not visible. Its heading and rule are not rendered. In paged mode, such a page is skipped and not counted in progress. This is computed in `/core`, not in `/react`. It has no effect on the payload.

## 3. Condition rules

1. `enableWhen` is allowed on questions, groups and pages.
2. **Ordering rule:** a condition's source must come **before** its dependent in reading order — a depth-first, pre-order walk of the tree (a container is visited before its children).
   - This one rule means a group or page can never depend on its own descendants.
   - It makes cycles impossible, so no separate cycle check is needed.
   - The first page can never have a condition, so at least one page is always visible.
3. Not allowed as a source: `group`, `page`, `matrix`, `long`, `divider`, `heading`, `title`, `label`, `hidden`, `text`, `image`, `video`.
4. **Visibility:** an item is visible if and only if its own conditions pass **and** every ancestor is visible.
5. A hidden source makes only **that condition** fail (existing rule, matters for `"any"`).
6. **Hidden answers:** kept in state and sessionStorage, re-shown when visible again, never submitted, never validated (existing rule).

## 4. Numbering

- Continuous 1…n in reading order across the whole tree.
- Only answerable questions are numbered. Groups, pages and presentational blocks are not.
- Numbers are static: hiding does not renumber (gaps are expected).
- Numbering is shown in the **builder only** (canvas and condition-source picker). The renderer does not display question numbers.

## 5. Payload

Unchanged. `answers` stays a flat map keyed by block id. Groups and pages contribute nothing.
The payload filter now walks the tree and keeps only **visible answerable questions**. Unknown ids, groups, pages and presentational blocks are dropped. "Answerable" is one list in `/core`, shared by validation and the payload filter.

## 6. Integrity checks

The builder rejects these at save (400 naming the block). The renderer throws at mount (defence against hand-edited schemas):

- duplicate id anywhere in the tree;
- page not at the root, or a mixed root;
- blank group `label` / page `title`;
- condition referencing an unknown id;
- condition source not before its dependent (ordering rule);
- condition source of a disallowed type (section 3.3).

## 7. Rendering (renderer only)

- Group → `<fieldset>` with a `<legend>` containing the label as a heading.
- Heading level: in a single-page form, root-level groups use `h2`; in a paged form the page title is `h2` and its root-level groups `h3`. Each nesting level adds one, **capped at `h6`** (nesting continues; only the level stops rising). Author heading blocks keep their own `level`.
- Public class names include `yf-group`, `yf-group-legend`, `yf-page`, `yf-page-title`, `yf-nav`, `yf-next`, `yf-back`, `yf-progress`, `yf-progress-bar`, `yf-review` (additive under the existing class-name policy, which starts at the first release to a client). This list is not exhaustive; the renderer's `classNames` constant and its contract test are the complete, authoritative list.

## 8. Paged behaviour (renderer only)

- **Next** validates only the current page's visible questions; errors block moving on. **Back** never validates.
- Hidden pages are skipped in both directions.
- The last visible page shows **Submit**, or **Review** when `reviewPage` is on.
- Final submit re-validates every visible page. If errors exist, go to the first page that has them.
- Pressing Enter on a non-final page triggers Next, never Submit.
- On page change, move focus to the page title.
- sessionStorage (same key) stores answers, idempotency key and the current **page id** (not index — indexes shift as pages hide). If the stored page is hidden or missing on restore, open the nearest preceding visible page, else the first.
- One idempotency key per form fill, across all pages.
- **Completed page:** visited **and** currently passes validation. It becomes incomplete again if a later change reveals a required question on it.
- **Progress** (`showProgress`): a caption "Step x of y" over displayed pages, shown above the page title and part of its heading, so it is announced when focus moves to the title. When `reviewPage` is on, the review step is the last step and is counted. `y` may change as answers change. There is no step list and no navigation from the progress indicator.
- **Progress bar:** when `progressStyle` is `"bar"`, a display-only segmented bar appears above the caption — one segment per step: completed, current, pending — hidden from assistive technology, never clickable. The caption always stays. The host can override the author's choice either way with `data-yf-progress-style="bar"` or `"caption"` on any wrapper; the host's attribute wins. The bar is only shown when the package stylesheet is loaded.
- **No step jumping.** Respondents return to earlier pages with Back, or with Change on the review page.
- **Review page** (`reviewPage`): lists every visible question on every displayed page, grouped by page, with group labels as subheadings; unanswered ones show "Not answered"; each page has a **Change** button (a `<button>`, not a link) that opens it. A page opened from review shows **Return to review**. Pressing it first validates the current page: if it has errors, stay there and show its error summary, as Next does. Otherwise go to the first displayed page that isn't completed, if any (with its summary if it has errors), otherwise back to review. Submit lives on the review page.
- **Unvisited pages open clean.** Whenever Return to review lands on a page the respondent has never visited, it opens without an error summary or flagged errors, even if it has unanswered required questions. Its errors appear only when the respondent presses that page's primary button. "With its error summary" elsewhere in this section applies to visited pages only.

## 9. Display blocks: `text` and `image`

Both are presentational: no value, never validated, never a condition source, never numbered, no help text shown. They may carry their own `enableWhen`. The builder exports `required: false` on them; the renderer ignores it.

- **`text`:** `content` is plain text (never HTML or Markdown), rendered as a paragraph with line breaks kept. Blank or whitespace-only `content` renders nothing.
- **`image`:** `content` is the image source. Leading and trailing whitespace is trimmed first; the builder stores the trimmed value. A **valid source** is either:
  - **absolute:** the trimmed string starts with `https://` (case-insensitive) **and** parses with the URL constructor to `protocol === "https:"` **with no `user@` or `user:pass@` credentials** (browsers refuse such image requests anyway); or
  - **root-relative:** the trimmed string starts with `/`, and resolving it against a fixed placeholder base (`new URL(src, "https://base.invalid")`) keeps that base's origin. This rejects protocol-relative forms such as `//cdn…`, `/\evil.com` and `/<tab>/evil.com`.

  Validity is defined by this resolution rule, not by string prefix alone. Both repos implement it identically and share the same test table (valid: `https://example.com/a.png`, `HTTPS://example.com/a.png`, `/images/a.png`, `  /images/a.png  `; invalid: empty, whitespace, `http://example.com/a.png`, `https:example.com/a.png`, `//cdn.example.com/a.png`, `/\evil.com/a.png`, `/\t/evil.com/a.png`, `data:image/png;base64,AAAA`, `javascript:alert(1)`, `images/a.png`, `<img src=x>`, `https://user@cdn.example.com/a.png`, `https://user:pass@cdn.example.com/a.png`).

  Anything invalid renders nothing — never a broken image and never a thrown error. The block's `label` is the image's alt text. The builder rejects an invalid or empty source at save.
- **Where a root-relative path resolves:** against the host's `assetBase` prop when it is set (e.g. a host served under `/external-test-app/` passes that), otherwise against the page's origin. This keeps schemas independent of where a client deploys. Absolute `https://` sources ignore `assetBase`.
- **Known limit:** displayability is decided in `/core`, which cannot know whether an image actually loads. An image whose source is valid but fails to load (e.g. 404) renders nothing in the browser, but a group containing only that image still shows its heading.

## 10. Display block: `video`

Presentational, like `text` and `image` (§9): no value, never validated, never a condition source, never numbered, no help text shown; may carry its own `enableWhen`; `required` is ignored. `content` is the source, trimmed first; the builder stores the trimmed value. The block's `label` is the player's accessible name (`title`).

**Recognised sources** — anything else renders nothing, never an error. Recognition is done by parsing the URL, never by substring search: protocol must be `https:`; the host must match exactly (no port, no `user@` credentials); the path must match exactly (no trailing slash variants).

| Kind | Accepted input | Rendered as |
|---|---|---|
| YouTube | **`youtu.be`**: path `/ID` only. **`youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtube-nocookie.com`, `www.youtube-nocookie.com`**: paths `/watch` with `v=ID`, `/embed/ID`, `/shorts/ID`, `/live/ID`. `ID` is exactly 11 characters of `A–Z a–z 0–9 _ -`. | iframe `https://www.youtube-nocookie.com/embed/ID?rel=0` (plus `&start=N`) |
| Vimeo | **`vimeo.com`, `www.vimeo.com`**: paths `/ID` or `/ID/HASH`, with optional query `h=HASH`. **`player.vimeo.com`**: path `/video/ID`, with optional `h=HASH`. `ID` is digits only; `HASH` is alphanumeric. | iframe `https://player.vimeo.com/video/ID?dnt=1` (plus `&h=HASH`) |
| Video file | a valid source per §9 (absolute `https://`, or root-relative resolved against `assetBase`) whose path, before any `?` or `#`, ends in `.mp4` or `.webm` (case-insensitive), **and whose host is not one of the YouTube or Vimeo hosts above** | native `<video>` |

- **Player hosts are exclusive:** a URL on a YouTube or Vimeo host is either a recognised player link or not recognised at all; it never falls through to the file kind.
- **Start time (YouTube):** from `t` or `start`, as bare seconds (`90`) or `NhNmNs` with any parts present (`90s`, `1m30s`, `1h2m3s`). A start of 0 is omitted. A malformed value (e.g. `t=abc`) is ignored: the video is still recognised, with no start time. If both `t` and `start` are present, the first **valid** one wins, `t` checked first (so `t=abc&start=20` starts at 20). `0` is a valid value, so `t=0&start=20` means no start time.
- **Vimeo hash:** if a hash appears both in the path and in `?h=`, the path hash wins; a malformed `?h=` is ignored and the video kept.
- **Default port:** `:443` is removed by URL parsing, so `https://www.youtube.com:443/…` counts as no port and is recognised. Any other port is rejected.
- **File videos** follow §9, so credentials are rejected there too.

Both repos implement this identically and share this test table:

- **Recognised:** `https://www.youtube.com/watch?v=dQw4w9WgXcQ`; `https://youtu.be/dQw4w9WgXcQ?t=90`; `https://youtu.be/dQw4w9WgXcQ?t=90s`; `https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s`; `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s`; `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=abc` (no start); `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0` (no start); `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=abc&start=20` (start 20); `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0&start=20` (no start: `t=0` is valid); `https://www.youtube.com/shorts/dQw4w9WgXcQ`; `https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ`; `https://vimeo.com/76979871`; `https://vimeo.com/76979871/abc123def4`; `https://vimeo.com/76979871?h=abc123def4`; `https://player.vimeo.com/video/76979871?h=abc123def4`; `https://cdn.example.com/intro.mp4`; `/videos/intro.WEBM`; `  https://youtu.be/dQw4w9WgXcQ  `.
- **Not recognised:** empty; `http://www.youtube.com/watch?v=dQw4w9WgXcQ`; `https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ`; `https://evil.com/?u=https://youtu.be/dQw4w9WgXcQ`; `https://www.youtube.com/watch?v=short`; `https://www.youtube.com/playlist?list=PL123`; `https://youtu.be/watch?v=dQw4w9WgXcQ`; `https://www.youtube.com/dQw4w9WgXcQ`; `https://www.youtube.com/shorts/dQw4w9WgXcQ/`; `https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ`; `https://user@www.youtube.com/watch?v=dQw4w9WgXcQ`; `https://www.youtube.com/clip.mp4`; `https://vimeo.com/channels/staffpicks`; `https://vimeo.com/abc`; `https://cdn.example.com/intro.mov`; `https://user@cdn.example.com/intro.mp4`; `//cdn.example.com/intro.mp4`; `javascript:alert(1)`; `<iframe src=x></iframe>`.

**Rendering rules:**
- A responsive 16:9 frame at full width for YouTube and Vimeo; the native `<video>` keeps the file's own aspect ratio, `max-width: 100%`.
- Never autoplays. `<video>` has `controls`, `preload="metadata"`, `playsinline`.
- Iframes: `title` = label, `loading="lazy"`, `allow="encrypted-media; picture-in-picture; fullscreen"`, `allowfullscreen`, `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"` (each verified necessary in a real browser; the last lets "Watch on YouTube/Vimeo" open as a normal tab rather than a crippled sandboxed one), `referrerpolicy="strict-origin-when-cross-origin"` (sends only the site's origin, never the page path; YouTube refuses to play embeds sent with no referrer).
- Captions are the author's responsibility on YouTube and Vimeo; direct video files have no caption support in v1.
- `rel=0` only limits YouTube's end-of-video suggestions to the same channel; it does not remove them.
- `<video>` has no `referrerpolicy` attribute, so a third-party video file is requested with the host page's own referrer policy. Hosts should set `Referrer-Policy: strict-origin-when-cross-origin` (the browser default) or stricter, so the page path is never sent.

**Host setup:** the host's Content Security Policy must allow `frame-src https://www.youtube-nocookie.com https://player.vimeo.com` for those players, and `media-src` for wherever its own video files live.

**Known limit:** as with images (§9), a recognised source that fails to play still counts as displayable in `/core`.