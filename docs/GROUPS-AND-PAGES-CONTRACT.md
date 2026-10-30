# Groups and Pages — Schema Contract

Status: agreed 25 Sep 2026; amended 5 Oct 2026 for repeating groups (§12, with matching changes in §1–§8); amended 6 Oct 2026 for coded options and option import (§13); amended 7 Oct 2026 for the grid block (§14); amended 9 Oct 2026 for custom condition logic (§15); amended 13 Oct 2026 for host validators (§16); amended 14 Oct 2026 for grid layout by available width (§14.5); amended 14 Oct 2026 for the required marker and ranking announcements (§7); amended 15 Oct 2026 for scoring (§17, with matching changes in §1, §6 and §13.1); amended 15 Oct 2026 for the package rename (`@zoworkhq/forms`, public prefix `zf-`: §7, §8, §12.6, §14.5); amended 27 Oct 2026 for new page titles (§2.5) and builder-only save rules for scale and number (§6); amended 28 Oct 2026 for empty answers and link answers (§5); amended 28 Oct 2026 for clearing answers (§7, §14.5) and naming the question in each error summary entry (§12.5); amended 28 Oct 2026 for video captions (§10) and the form's title and description (§7); amended 29 Oct 2026 for the builder's captions setting (§10); amended 30 Oct 2026 for the renderer's nesting limit (§2.1, §6), value formats and stored answers (§5), text-value checks (§6), schemas the renderer refuses (§7) and the repeat ceiling (§12.1); amended 30 Oct 2026 for counts in the respondent's locale (§12.2) and refusing too many instances first (§12.5). Shared by the builder repo and the `@zoworkhq/forms` renderer repo.
Both implementations must follow this file exactly. Change it here first, then in both repos.

## 1. Shapes

```ts
// Group — nested up to the limit in §2.1, at the root or inside a page/group
{ id: string; type: "group"; label: string;
  enableWhen?: EnableWhenCondition[]; enableBehavior?: "any";
  repeats?: boolean; repeatLabel?: string;     // repeating group, see §12
  minOccurs?: number; maxOccurs?: number;      // repeating group, see §12
  scores?: Score[];                            // see §17
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
- `enableWhen` / `enableBehavior` have the existing contract, extended by §15: every condition has an `id`, and an item may carry `enableLogic` instead of `enableBehavior`. The builder stores only `"any"`; absent means all. The renderer also accepts an explicit `"all"`.
- No `mode` field: a form is **paged if and only if its root contains pages**.
- The page `title` is the wizard step name. There is no separate step-name field.
- `navigation` is ignored when the form is not paged.
- Groups and pages have no value, no `required`, no `completeRequired`.

## 2. Structure rules

1. Groups nest, with two limits. The **builder** refuses a group nested more than 20 deep at save: inside 20 or more other groups (§6, builder only). The **renderer** refuses, at mount and in `/core`, a group inside 100 or more other groups (§6). A page doesn't count towards either.
2. `page` may appear only at the root — never inside a group or another page.
3. If any root item is a page, **every** root item must be a page (no mixed root).
4. Block ids are unique across the whole tree, including group and page ids.
5. `label` (group) and `title` (page) are required and non-blank. The builder defaults a new group's label to "Untitled group". It titles a new page "Page n", where n is the number of pages once it is added, raised to the next number no other page's title uses; "Split into pages" gives "Page 1" and "Page 2".
6. Empty group or page (`blocks: []`): **builder rejects at save**; **renderer renders nothing** for it (does not throw).
7. **Effectively empty:** a group or page with no *displayable* descendant — every descendant is hidden by conditions, or is a `hidden`-type block, a `text` block with blank `content`, an `image` block without a valid source (see §9), a `video` block without a recognised source (see §10), or an `audio` block without a recognised source (see §11) — is treated as not visible. Its heading and rule are not rendered. In paged mode, such a page is skipped and not counted in progress. This is computed in `/core`, not in `/react`. It has no effect on the payload.
   - **Repeating groups:** decided on the group's template (its `blocks`), not on its instances. A repeating group whose template has a displayable descendant (ignoring that descendant's own conditions, which are evaluated per instance) is displayable even with zero instances, because its Add button must show.

## 3. Condition rules

1. `enableWhen` is allowed on questions, groups and pages.
2. **Ordering rule:** a condition's source must come **before** its dependent in reading order — a depth-first, pre-order walk of the tree (a container is visited before its children).
   - This one rule means a group or page can never depend on its own descendants.
   - It makes cycles impossible, so no separate cycle check is needed.
   - The first page can never have a condition, so at least one page is always visible.
3. Not allowed as a source: `group`, `page`, `matrix`, `grid`, `long`, `divider`, `heading`, `title`, `label`, `hidden`, `text`, `image`, `video`, `audio`.
4. **Visibility:** an item is visible if and only if its own conditions pass **and** every ancestor is visible.
5. A hidden source makes only **that condition** fail (existing rule, matters for `"any"`).
6. **Hidden answers:** kept in state and sessionStorage, re-shown when visible again, never submitted, never validated (existing rule).
7. **Prefix rule (repeating groups, §12.3):** a condition's source is allowed only if every repeating group enclosing the source also encloses the dependent. It applies alongside the ordering rule.
8. **Custom logic (§15):** when an item has `enableLogic`, its conditions are combined by that tree instead of by `enableBehavior`. Rules 2, 3, 5 and 7 apply to every condition, at any depth of the tree.

## 4. Numbering

- Continuous 1…n in reading order across the whole tree.
- Only answerable questions are numbered. Groups, pages and presentational blocks are not.
- Numbers are static: hiding does not renumber (gaps are expected).
- Numbering is shown in the **builder only** (canvas and condition-source picker). The renderer does not display question numbers.
- Questions inside a repeating group are numbered once, as they appear in the template.

## 5. Payload

`answers` stays a flat map keyed by block id. Groups and pages contribute nothing. **Exception:** a repeating group contributes an array of instance objects under its own id (§12.4).
The payload filter now walks the tree and keeps only **visible answerable questions**. Unknown ids, groups, pages and presentational blocks are dropped. "Answerable" is one list in `/core`, shared by validation and the payload filter.

**Empty answers.** An answered value that is an empty array, an empty object, or a string that is empty or whitespace only counts as no answer, for every question type: `required`, conditions, scores, the review page and the payload all see `{ state: "empty" }`, and `prepareSubmission` returns it that way. The rendered form never sends such a value; the rule guards hand-made payloads. Non-blank text is never trimmed. A grid applies the rule per cell (§14.2).

**Link answers.** `/core`, and so the browser, accepts a `link` answer only when its trimmed text parses with the URL constructor to `protocol` `https:` or `http:`, with a non-empty host and no `user@` or `user:pass@` credentials. This is decided by parsing, never by string prefix. Anything else is rejected with "Enter a valid URL, including https://.". The stored value keeps its surrounding whitespace, as for every free-text answer. Both repos share this test table:

- **Accepted:** `https://example.org`; `HTTPS://example.org/a?b=1`; `http://example.org`; `  https://example.org  `.
- **Rejected:** `javascript:alert(1)`; `JavaScript:void(0)`; ` javascript:alert(1)`; `data:text/html,hi`; `mailto:a@b.org`; `tel:+15551234567`; `ftp://example.org`; `example.org`; `//example.org`; `https://`; `https://user@example.org`; `https://user:pass@example.org`.

**Value formats.** `/core`, and so the browser, accepts these answered values for `number`, `date` and `time`, and rejects anything else with the type's usual message:

- **`number`:** a finite JSON number, or a string whose trimmed text is a plain decimal number (`^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$`) with a finite value. `prepareSubmission` returns such a string as the number it reads as. Anything else is rejected with "Enter a valid number.": hexadecimal, `Infinity`, a value too large to be finite (`1e400`), a boolean, an array, an object. `min` and `max` apply to the number. `scale` and `rating` read a numeric string by the same rule before their own checks.
- **`date`:** a string `YYYY-MM-DD` that is a real calendar date. Anything else, an array included, is rejected with "Enter a valid date.".
- **`time`:** a string `HH:MM` or `HH:MM:SS`, with hours `00`–`23` and minutes and seconds `00`–`59`. Anything else is rejected with "Enter a valid time.". The renderer's own input sends `HH:MM`.

Both repos share this test table:

- **Number, accepted:** `42`; `-3.5`; `"50"` (as `50`); `" 7 "` (as `7`); `"1e2"` (as `100`); `".5"` (as `0.5`).
- **Number, rejected:** `"0x10"`; `"Infinity"`; `"-Infinity"`; `"1e400"`; `"abc"`; `true`; `[5]`; `["5"]`; `{ "n": 5 }`; `null`. (`{}`, `[]` and `""` are empty answers under the rule above, not rejections.)
- **Date, accepted:** `"2024-02-29"`. **Rejected:** `"2023-02-29"`; `"2024-13-01"`; `["2024-01-01"]`; `20240101`; `"+002024-01-01"`.
- **Time, accepted:** `"09:30"`; `"23:59"`; `"00:00:59"`. **Rejected:** `"24:00"`; `"23:60"`; `"99:99"`; `"12:00:60"`; `["12:00"]`; `1200`.

**What `prepareSubmission` returns.** Every answer it returns is built afresh, never the object that was sent: exactly `{ state: "empty" }`, or `{ state: "answered", value }` with the value rebuilt for its type: free text, `date`, `time` and `country` as the string; `number`, `scale` and `rating` as a number; coded answers labelled as in §13.5; a grid as in §14.2. Any other key on an answer, and any `value` on an empty answer, is dropped. The same applies inside every repeating-group instance (§12.4).

## 6. Integrity checks

The builder rejects these at save (400 naming the block). The renderer throws at mount (defence against hand-edited schemas):

- duplicate id anywhere in the tree;
- page not at the root, or a mixed root;
- blank group `label` / page `title`;
- condition referencing an unknown id;
- condition source not before its dependent (ordering rule);
- condition source of a disallowed type (section 3.3);
- condition source breaking the prefix rule (§3.7, §12.3);
- `repeats: true` on a page;
- `repeats: true` with a blank or missing `repeatLabel`;
- `minOccurs` not a whole number ≥ 0; `maxOccurs` not a whole number ≥ 1, or less than `minOccurs`.
- any §15.5 logic rule broken;
- any §17.6 scoring rule broken;
- a group inside 100 or more other groups (a page doesn't count; §2.1);
- `blocks` that is not an array, on the form, a group or a page; a block that is not an object with a string `id` and a string `type`; `options`, `columns` or `rows` present but not an array;
- a text value the renderer shows that is present, not `null`, and not a string: the form's `title` and `description`; a block's `label`, `title`, `description` and `placeholder` (a repeating group's `repeatLabel` has its own check above); `content` on `text`, `heading`, `label` and `title` blocks; the `label` of every option, matrix column, grid row, grid column and grid-cell option. `null` counts as absent.

`repeatLabel`, `minOccurs` and `maxOccurs` on a group without `repeats: true` are ignored, not rejected.

**Builder only.** The builder also rejects these at save (400 naming the block). The renderer does not throw for them and renders such a schema as it does today: a scale with `min` above `max` shows no points, and one with more than 20 points shows the first 20.

- a `scale` whose `min` or `max` is not a whole number, whose `min` is greater than its `max`, or that has more than 20 points (`max − min + 1`); an absent `min` counts as 1 and an absent `max` as 5;
- a `number` whose `min` is greater than its `max`;
- a group nested more than 20 deep: inside 20 or more other groups (a page doesn't count). The renderer mounts deeper nesting, up to its own limit above.

## 7. Rendering (renderer only)

- **Schemas the renderer refuses.** Wherever this contract says the renderer *throws at mount* (§6, §13.6, §14.4, §15.5, §16.2, §17.6), the form is not shown. In its place the renderer shows "This form can't be shown right now. Please try again later." (`role="alert"`, class `zf-unavailable`) and passes the error to the host's `onRenderError` callback; the host's own page stays up. A development build also shows the error's text in the message. `/core` still throws the same errors to its callers (`assertSchemaIntegrity`, `validateSubmission`, `prepareSubmission`).
- **Form title and description:** the renderer never shows the form's `title` or `description`; the host does, and owns the page's `h1`.
- Group → `<fieldset>` with a `<legend>` containing the label as a heading.
- Heading level: in a single-page form, root-level groups use `h2`; in a paged form the page title is `h2` and its root-level groups `h3`. Each nesting level adds one, **capped at `h6`** (nesting continues; only the level stops rising). Author heading blocks keep their own `level`.
- Public class names include `zf-group`, `zf-group-legend`, `zf-page`, `zf-page-title`, `zf-nav`, `zf-next`, `zf-back`, `zf-progress`, `zf-progress-bar`, `zf-review` (additive under the existing class-name policy, which starts at the first release to a client). This list is not exhaustive; the renderer's `classNames` constant and its contract test are the complete, authoritative list.
- **Public prefix:** every public identifier the renderer exposes — class names, data attributes, CSS custom properties — uses the `zf-` prefix (`--zf-` for custom properties). No other prefix is public.
- Repeating groups render as described in §12.6.
- **Required marker:** the visible `*` is decoration only and is never part of any accessible name, whether or not the package stylesheet is loaded. A required question's name is exactly its label (e.g. "Priorities", never "Priorities *"). "Required" is conveyed by native `required`, by `aria-required`, or, on questions rendered as a fieldset, by a "Required" description listed first in the fieldset's `aria-describedby`.
- **Ranking:** each option button's name is exactly its option label. Its description gives its rank ("Ranked 2 of 3") or "Not ranked". Each ranking question has a polite status region, present from first render, that announces every change: "Speed ranked 2 of 3." when ranking, and "Speed unranked. Order: 1 Cost, 2 Quality." (or "Speed unranked. Nothing ranked.") when un-ranking.
- **Clearing an answer:** choosing the selected option of a `choice` again clears it, and so does pressing the pressed star of a `rating` again. In a `matrix`, choosing a row's selected column again clears that row; once no row is answered the matrix is empty. A `choice` that is not `required`, and a `matrix` with neither `required` nor `completeRequired`, also shows a **Clear selection** button while it has an answer. It clears the whole question and moves focus to the question's first radio. Its accessible name is "Clear selection, {label}", with the visible text first. A cleared answer is `{ state: "empty" }` (§5). Grid radio cells: §14.5.

## 8. Paged behaviour (renderer only)

- **Next** validates only the current page's visible questions, in every instance of every repeating group on it; errors block moving on. **Back** never validates.
- Hidden pages are skipped in both directions.
- The last visible page shows **Submit**, or **Review** when `reviewPage` is on.
- Final submit re-validates every visible page. If errors exist, go to the first page that has them.
- Pressing Enter on a non-final page triggers Next, never Submit.
- On page change, move focus to the page title.
- sessionStorage (same key) stores answers, idempotency key and the current **page id** (not index — indexes shift as pages hide). If the stored page is hidden or missing on restore, open the nearest preceding visible page, else the first.
- One idempotency key per form fill, across all pages.
- **Completed page:** visited **and** currently passes validation. It becomes incomplete again if a later change reveals a required question on it.
- **Progress** (`showProgress`): a caption "Step x of y" over displayed pages, shown above the page title and part of its heading, so it is announced when focus moves to the title. When `reviewPage` is on, the review step is the last step and is counted. `y` may change as answers change. There is no step list and no navigation from the progress indicator.
- **Progress bar:** when `progressStyle` is `"bar"`, a display-only segmented bar appears above the caption — one segment per step: completed, current, pending — hidden from assistive technology, never clickable. The caption always stays. The host can override the author's choice either way with `data-zf-progress-style="bar"` or `"caption"` on any wrapper; the host's attribute wins. The bar is only shown when the package stylesheet is loaded.
- **No step jumping.** Respondents return to earlier pages with Back, or with Change on the review page.
- **Review page** (`reviewPage`): lists every visible question on every displayed page, grouped by page, with group labels as subheadings; unanswered ones show "Not answered"; each page has a **Change** button (a `<button>`, not a link) that opens it. A page opened from review shows **Return to review**. Pressing it first validates the current page: if it has errors, stay there and show its error summary, as Next does. Otherwise go to the first displayed page that isn't completed, if any (with its summary if it has errors), otherwise back to review. Submit lives on the review page. Repeating groups are listed as in §12.6.
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

Presentational, like `text` and `image` (§9): no value, never validated, never a condition source, never numbered, no help text shown; may carry its own `enableWhen`; `required` is ignored. `content` is the source, trimmed first; the builder stores the trimmed value. The block's `label` is the player's accessible name (`title`). A video file may also carry `captions?: string`, a captions file (see **Captions** below).

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
- `rel=0` only limits YouTube's end-of-video suggestions to the same channel; it does not remove them.
- `<video>` has no `referrerpolicy` attribute, so a third-party video file is requested with the host page's own referrer policy. Hosts should set `Referrer-Policy: strict-origin-when-cross-origin` (the browser default) or stricter, so the page path is never sent.

**Captions:**
- **YouTube and Vimeo:** captions are the author's responsibility, set on that service. `captions` is ignored there.
- **Video files:** `captions` is the address of a captions file, trimmed first; the builder stores the trimmed value. It is recognised when it is a valid source per §9 (absolute `https://` with no credentials, or root-relative, resolved against `assetBase`) whose path, before any `?` or `#`, ends in `.vtt` (case-insensitive). It renders as `<track kind="captions" label="Captions">` inside the `<video>`, with no `default`: captions are off until the respondent turns them on in the player.
- **Missing or broken:** an absent, blank or unrecognised `captions` renders the video without a track, never an error; the renderer warns in development when it is not blank. A captions file that fails to load leaves the video playing without captions.
- **Another origin:** when the captions file's origin differs from the page's, the `<video>` gets `crossorigin="anonymous"`, so the browser requests both the captions and the video file with CORS. If the video then fails to load, it is rendered once more without `crossorigin` and without captions, and the renderer warns in development. It is not retried again: if that load fails too, the video renders nothing, as any failed video file does.
- **Builder:** the Video settings show **Captions** only while the source is a recognised video file. The builder stores the trimmed value, leaves `captions` out when it is blank, and rejects an unrecognised one at save (400 naming the block). When the source changes to YouTube or Vimeo, a stored `captions` is kept, the field is hidden and the save check skips it; the renderer ignores it there (above). Schemas without `captions` render as before.

Both repos share this captions test table, on a recognised video file:
- **Recognised:** `https://cdn.example.com/intro.vtt`; `https://cdn.example.com/intro.VTT?v=2`; `/captions/intro.vtt`; `  /captions/intro.vtt  `.
- **Not recognised:** empty; `http://cdn.example.com/intro.vtt`; `//cdn.example.com/intro.vtt`; `https://user@cdn.example.com/intro.vtt`; `https://cdn.example.com/intro.srt`; `https://cdn.example.com/?file=intro.vtt`; `/captions/`; `data:text/vtt,WEBVTT`; `javascript:alert(1)`.

**Host setup:** the host's Content Security Policy must allow `frame-src https://www.youtube-nocookie.com https://player.vimeo.com` for those players, and `media-src` for wherever its own video and captions files live. A captions file on another origin than the page also needs `Access-Control-Allow-Origin` on both the captions file and the video file.

**Known limit:** as with images (§9), a recognised source that fails to play still counts as displayable in `/core`.

## 11. Display block: `audio`

Presentational, like `video` (§10): no value, never validated, never a condition source, never numbered, no help text shown; may carry its own `enableWhen`; `required` is ignored. `content` is the source, trimmed first; the builder stores the trimmed value. The block's `label` is the player's accessible name.

**Recognised source:** a valid source per §9 (absolute `https://` with no credentials, or root-relative resolved against `assetBase`) whose path, before any `?` or `#`, ends in `.mp3`, `.m4a`, `.ogg` or `.wav` (case-insensitive). No third-party players or streaming services. Anything else renders nothing, never an error.

Both repos share this test table:
- **Recognised:** `https://cdn.example.com/welcome.mp3`; `https://cdn.example.com/welcome.M4A?v=2`; `/audio/breathing.ogg`; `/audio/breathing.wav#t=10`; `  /audio/intro.mp3  `.
- **Not recognised:** empty; `http://cdn.example.com/welcome.mp3`; `//cdn.example.com/welcome.mp3`; `https://user@cdn.example.com/welcome.mp3`; `https://cdn.example.com/welcome.flac`; `https://cdn.example.com/welcome.mp3.exe`; `https://cdn.example.com/?file=welcome.mp3`; `https://open.spotify.com/track/abc`; `/audio/`; `javascript:alert(1)`; `<audio src=x>`.

**Rendering rules:**
- Native `<audio>` with `controls`, `preload="metadata"`, `aria-label` = label; full width up to the form's width.
- Never `autoplay`, `loop` or `muted`.
- On a load error, renders nothing.
- `<audio>` has no `referrerpolicy` attribute; the host's `Referrer-Policy` applies, as for video files (§10).
- Prerecorded audio-only content needs a text alternative to meet WCAG 2.1 AA (1.2.1). That is the author's responsibility: put a transcript in a `text` block next to it.

**Host setup:** the host's Content Security Policy must allow `media-src` for wherever its audio files live.

**Known limit:** as with images and video, a recognised source that fails to load still counts as displayable in `/core`.

## 12. Repeating groups

Agreed 5 Oct 2026. A repeating group lets the respondent fill the same set of questions any number of times (e.g. several patients, several payments). Modelled on FHIR's `group` item with `repeats: true` and the SDC `minOccurs` / `maxOccurs` extensions.

### 12.1 Shape

```ts
{ id: string; type: "group"; label: string;
  repeats: true;
  repeatLabel: string;      // singular noun for one instance, e.g. "patient"
  minOccurs?: number;       // whole number ≥ 0; default 1
  maxOccurs?: number;       // whole number ≥ 1 and ≥ minOccurs; absent = at most 1,000
  enableWhen?: EnableWhenCondition[]; enableBehavior?: "any";
  blocks: Block[] }         // the template for one instance
```

- A repeating group is a `group` with `repeats: true`. It follows every group rule in §2 unless this section says otherwise.
- **An absent `maxOccurs`** means at most 1,000 instances, in the renderer and in `/core`: Add stops there as at any `maxOccurs` (§12.2), and `/core` rejects more (§12.5). An explicit `maxOccurs` above 1,000 is the author's choice and applies as written.
- `label` is the section heading for the whole list (e.g. "Patients"). `repeatLabel` names one instance.
- `repeatLabel` is used **verbatim** in buttons and messages ("Add another patient") and with its **first character upper-cased** in headings and the error summary ("Patient 2"). The builder tells authors to write it as it should appear mid-sentence (lower case unless it is a proper noun or acronym).
- When "Repeats" is turned on, the builder writes `minOccurs: 1` and a `repeatLabel` of "item"; the author can change both.
- **Nesting:** repeating groups may contain plain groups and other repeating groups, to any depth. A repeating group may sit anywhere a group may (root of a single-page form, inside a page, inside any group). Pages never repeat.
- Instances have internal ids (stable for the instance's lifetime, never derived from position). They never appear in the schema, the payload or drafts.

### 12.2 Instances

- The form starts with `minOccurs` instances. With `minOccurs: 0` it starts with none, showing only the Add button.
- **Add** appends one instance at the end. Its text is "Add {repeatLabel}" when there are no instances and "Add another {repeatLabel}" otherwise.
- At `maxOccurs`, Add is disabled and the text "You can add up to {maxOccurs}." is shown next to it, the number in the respondent's locale ("You can add up to 1,000." in English). Every count the renderer shows in text — instance numbers, ranks, the progress step, missing grid cells, rating stars — is formatted the same way. When an Add reaches the limit, that text is also announced through the repeat's polite status region, since focus has moved to the new instance and a disabled button is not focusable.
- **Remove** is offered on every instance and is disabled while the count equals `minOccurs`. With `minOccurs: 0`, every instance can be removed.
- Removing an instance that holds any answer anywhere in its subtree (including hidden answers and nested instances) first asks: "Remove {repeatLabel} {n}? Its answers will be deleted." (`window.confirm`, as Clear form does). An instance with no answers is removed without asking.
- Removing **deletes** the instance and everything in it from state and `sessionStorage`. This is deliberately unlike hiding (§3.6). There is no undo.
- Instance numbers follow position and renumber after a removal. They are display-only.
- **Clear form** resets every repeating group to `minOccurs` empty instances.

### 12.3 Conditions

- **Prefix rule:** a condition's source is allowed only if every repeating group enclosing the source also encloses the dependent. Equivalently, the chain of repeating ancestors of the source is a prefix of the dependent's chain. A repeating group's chain does not include itself.
- **Resolution:** the source is read in the dependent's own context. For each repeating group enclosing the source, the instance used is the one that also contains the dependent.

| Source is… | Allowed | Resolves to |
|---|---|---|
| outside any repeat | yes | the single global answer |
| in the same instance as the dependent | yes | that instance's answer |
| in an enclosing instance (e.g. a payment depends on its patient's field) | yes | the enclosing instance's answer |
| inside a repeat that does not enclose the dependent (e.g. "show X if any patient is under 18") | **no** | — (needs aggregate operators; not in this version) |

- The ordering rule (§3.2) still applies, in template order. It already stops a repeating group depending on its own descendants.
- **Visibility** inside an instance: an item is visible if its own conditions pass in that instance's context and every ancestor is visible in that context. Conditions are evaluated per instance, so the same question can be shown in one instance and hidden in another.
- A repeating group may carry its own `enableWhen`, evaluated in its enclosing context. When it is hidden, its instances (and their answers) are kept in state, re-shown when it becomes visible again, never submitted and never validated, as for hidden answers.
- Repeating groups are not condition sources (groups never are, §3.3).

### 12.4 Payload

A repeating group contributes **an array under its own id**. Each element is one instance, in display order, built with the same rules as the root level: a map of that instance's visible answerable questions keyed by block id, with nested repeating groups as arrays under their own ids. Plain groups inside an instance stay flat within that instance's object.

Question values keep the existing `BlockValue` wire format (`{ state, value }`); only the repeating group itself is a bare array.

```json
"answers": {
  "consent": { "state": "answered", "value": "yes" },
  "patients": [
    { "name": { "state": "answered", "value": "A" },
      "payments": [ { "amount": { "state": "answered", "value": 50 } } ] },
    { "name": { "state": "answered", "value": "B" },
      "payments": [] }
  ]
}
```

- A **visible** repeating group with zero instances sends `[]` ("answered: none").
- A **hidden** repeating group sends nothing (absent), the same as any hidden question.
- An instance with nothing to send is still sent as `{}`, so the array keeps the instance count and order.
- Instance ids are not sent.

### 12.5 Validation

- `required` applies within each instance that exists. `completeRequired` keeps its meaning per instance.
- For every **visible** repeating group, `/core` checks that the instance count is between `minOccurs` and `maxOccurs`. The UI cannot produce a count outside these limits, so this guards against hand-crafted payloads and uses the existing vague message ("Invalid answer.").
- **Too many instances first.** Before anything else in the answers is checked, `/core` (and so the browser's check) looks for a repeating group, at any depth and visible or not, whose value is an array longer than its `maxOccurs` (§12.1). If it finds one, it returns "Invalid answer." for that group alone and checks nothing else, so an oversized payload is refused without walking its instances. The form never produces such a value, even for a hidden group (§12.7).
- `prepareSubmission` and `validateSubmission` also reject a repeating group's value that is not an array, or an instance that is not an object, with the same vague message. They strip hidden and unknown answers per instance, as at the root.
- `ValidationError` gains `path: (string | number)[]`: block ids and 0-based instance positions from the root to the question, e.g. `["patients", 1, "payments", 0, "amount"]`. For a question outside any repeat, `path` is `[blockId]`. `blockId` stays as it is.
- In the browser, every error summary entry names its question. A message that doesn't already name it gets the question's label in quotes in front, as the grid's entries do (§14.3): `"Age": Must be at most 17.` Messages that already name the question (`"Age" is required.`, `Answer every row of "Symptoms".`, `Rank every option in "Priorities".`, matched exactly) and grid entries are shown as they are; so is every message on a question with a blank label. Inside repeating groups the enclosing instances come first, outermost first: `Patient 2, Payment 1: "Amount" is required.`, `Child 1: "Age": Must be at most 17.` Messages beside the field, and `ValidationError.message`, don't change.

### 12.6 Rendering (renderer only)

- The repeating group renders as a `<fieldset>` with its `label` in the `<legend>`, as a heading (§7).
- Each instance is a nested `<fieldset>` whose `<legend>` holds "{RepeatLabel} {n}" as a heading one level below the group's, capped at `h6`.
- Each instance's Remove button shows "Remove". Its accessible name is "Remove {repeatLabel} {n}", and inside a nested instance it also names **every** enclosing instance, outermost first, so no two buttons on the page share a name: "Remove payment 1 from patient 2", "Remove line item 1 from patient 2, payment 1". The Add button inside a nested instance is named the same way: "Add another payment to patient 2", "Add another line item to patient 2, payment 1". The visible text always begins the accessible name (WCAG 2.5.3).
- Element ids and error ids (`…__error`) are built from the instance ids along the path, never from positions, so they stay stable when an instance above is removed.
- **Focus:** after Add, focus moves to the new instance's heading. After Remove, focus moves to the previous instance's heading; if there is none, to the instance that took its place; if none remain, to the Add button. A polite `role="status"` region announces "{RepeatLabel} {n} removed."
- **Review page:** each instance is listed under its own subheading ("{RepeatLabel} {n}"), with nested instances nested the same way. A visible repeating group with zero instances shows "None added". An instance whose questions are all hidden still shows its subheading, so the numbering matches the form.
- Public class names include `zf-repeat`, `zf-repeat-instance`, `zf-repeat-legend`, `zf-repeat-add`, `zf-repeat-remove`, `zf-repeat-limit` and `zf-repeat-status` (additive, under the existing policy; the renderer's `classNames` constant stays authoritative).

### 12.7 State, sessionStorage and drafts

- Answer state for a repeating group is an ordered list of instances, each holding its own answer map, recursively.
- `sessionStorage` and drafts store instances **in order, without instance ids**; ids are regenerated on restore. Hidden answers inside instances are kept, as today. See DRAFTS-CONTRACT §5.
- On restore, a repeating group that is **absent** from stored data starts with `minOccurs` empty instances. A repeating group that is present but malformed, or whose instance count is outside `minOccurs`–`maxOccurs`, makes the stored data corrupt. A corrupt `sessionStorage` entry is discarded silently, as for any other bad shape. A device or server draft with the same `formVersionId` that is corrupt follows the existing unreadable-draft path: report `draft-unreadable`, delete it, and show "Your saved draft couldn't be opened, so you're starting a new form."

### 12.8 Builder

- The group inspector has a "Repeats" toggle (groups only, never pages) with `repeatLabel`, `minOccurs` and `maxOccurs`. The canvas shows a "Repeats" badge on the group.
- The condition-source picker offers only sources allowed by the prefix rule.
- Dependency guards, following the existing pattern (refuse, and name the dependent blocks with jump links):
  - refuse turning **on** "Repeats" when a condition outside the group uses a source inside it;
  - refuse a move (into, out of, or between repeating groups) that would break the prefix rule.
  Turning "Repeats" **off** never breaks a condition and is always allowed.

## 13. Coded options and option import

Agreed 6 Oct 2026. Every option has a stable **code** and a display **label**. Answers, conditions and stored data use the code; respondents see the label. Modelled on FHIR's coded answer options (code + display).

### 13.1 Shape

```ts
type Option = { code: string; label: string; score?: number };   // score: §17
```

- Applies to `options` on `choice`, `checkbox`, `multiselect`, `dropdown` and `ranking`, and to `matrix` `options` (its rows) and `columns`. It replaces the plain-string lists.
- `country`, `scale` and `rating` are unchanged.
- In an exported schema every option has a non-blank `code` and `label`. Codes are filled in by the builder (§13.3); the renderer never generates them.

### 13.2 Rules

- **Code:** trimmed first; a whitespace-only code counts as empty and is generated (§13.3). It then matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` — letters, digits, `.`, `-`, `_`; starts with a letter or digit; at most 64 characters. This fits clinical codes such as `F32.1`, `LA6568-5` and `44054006`. Restricting codes to this set protects every system codes travel into (client databases, logs, CSV exports).
- **Label:** any text, trimmed, not blank. Always displayed as **plain text, never HTML**, in both the builder and the renderer (the same rule as `text` blocks, §9). `<script>` in a label simply shows as those characters.
- **Uniqueness, within one list:** no two codes may be equal ignoring case, and no two labels may be equal ignoring case and surrounding whitespace. Matrix rows and matrix columns are separate lists. The same code in two different blocks is fine. Codes are stored as written.

### 13.3 Generating codes (builder only)

A code is generated for an option whose code is **empty**:

- in the editor, when the author leaves the option's label field **after changing it** (tabbing past an untouched placeholder such as "Option 3" generates nothing; leaving an empty code field generates nothing);
- in the editor, when an option whose code is empty is chosen as a condition answer (so the condition has a code to store);
- in the editor, when the author leaves a code field empty **and a condition uses that option**: the code is regenerated from the label straight away and the conditions follow it (§13.8), so a condition never points at a code that no longer exists;
- when imported rows are previewed (§13.9), so the preview shows real codes;
- at save, for any code still empty (e.g. a form created through the API).

**New options start with an empty code** — both the placeholder options a new block is created with ("Option 1", "Column 1", …) and options added with "Add option" — so the code is made from the label the author actually types, not from the placeholder. Options created from real labels (templates, import) are filled straight away.

The generated value only fills an empty field; the author can overwrite it at any time (§13.8). Every path uses one shared function in `packages/form-schema`, applying these steps:

1. Take the label; normalise it (Unicode NFKD) and remove accents (`Sí` → `Si`).
2. Lower-case it.
3. Replace each run of whitespace with `_`.
4. Remove every character other than `a–z`, `0–9`, `.`, `-`, `_`; collapse repeated `_`.
5. Remove leading and trailing `.`, `-`, `_`; cut to 64 characters (then trim trailing `.`, `-`, `_` again).
6. If nothing is left, use `option_{n}`, where `n` is the option's 1-based position in the list.
7. If the result equals an existing code in the list (ignoring case), append `_2`, `_3`, … — the first free one — shortening the base so the whole stays within 64 characters.

- Codes the author typed, and codes already saved, are reserved first; generated codes never take them.
- **A code is generated once and never regenerated.** Editing a label later never changes its code. Only empty codes are ever filled.
- The builder shows each option's code next to its label as soon as it exists.

| Label | Generated code |
|---|---|
| `Not applicable` | `not_applicable` |
| `Married, separated` | `married_separated` |
| `Sí` | `si` |
| `F32.1 Major depressive disorder` | `f32.1_major_depressive_disorder` |
| `--Yes--` | `yes` |
| `<script>alert(1)</script>` | `scriptalert1script` |
| `焦虑` (3rd option) | `option_3` |
| `Other!` when `other` is already a code | `other_2` |

### 13.4 Answers and conditions

- The answer value is the **code**: a string for `choice` and `dropdown`; an array of codes for `checkbox`, `multiselect` and `ranking`; `Record<rowCode, columnCode>` for `matrix`.
- `enableWhen.answer` holds the source option's **code**. The builder's condition editor shows labels and stores codes.
- Option membership (validation, conditions) compares codes exactly as stored.
- The browser's payload carries **codes only**.
- The review page, error messages and the builder show labels.

### 13.5 `prepareSubmission` returns labels

`prepareSubmission` (server side) returns each coded answer with its label **looked up from the schema it was given**, never from the request:

| Type | `value` in the returned answers |
|---|---|
| `choice`, `dropdown` | `{ code, label }` |
| `checkbox`, `multiselect`, `ranking` | `[{ code, label }, …]`, in the submitted order |
| `matrix` | `[{ row: { code, label }, column: { code, label } }, …]`, answered rows only, in row order |

- `state` and every other answer type are unchanged. Inside repeating groups (§12.4) the same applies per instance.
- A submitted value that is not a code of the list (including an object with a `label`) is rejected with the existing membership messages (vague by design, since the UI cannot produce it).

### 13.6 Integrity checks

The builder refuses these at save (400 naming the block); the renderer throws at mount:

- a missing or empty option list (for `matrix`, both rows and columns must be non-empty);
- an option that is not `{ code, label }`, or has a blank code or label;
- a code outside the allowed characters (§13.2);
- duplicate codes, or duplicate labels, within one list (§13.2);
- a condition `answer` that is not a string exactly equal to a code of its source's list (a number such as `44054006` does not match the code `"44054006"`);
- a condition on a coded source using an operator other than `exists`, `=` and `!=` (single-choice types) or `exists` and `contains` (`checkbox`, `multiselect`, `ranking`). Ordering operators (`>`, `<`, `>=`, `<=`) have no meaning on codes.

### 13.7 Rendering (renderer only)

- Labels are rendered as text nodes only. Input `value` attributes carry codes.
- If codes are used inside element ids, any CSS selector built from them is escaped (`CSS.escape`), since codes may contain `.`.
- Both repos test that a label such as `<img src=x onerror=alert(1)>` appears as literal text everywhere it is shown (builder canvas and inspector; renderer form, review page and error summary).

### 13.8 Builder editing

- The option editor shows each option's **code first, then its label**, the same order as import files (§13.9). Tab order follows the visual order.
- Labels can always be edited; their codes stay.
- **Codes can always be edited** (checked against §13.2 inline and at save). When a code changes, every condition in the form whose `answer` uses the old code is updated to the new one automatically, and the editor says how many were updated.
- A standing note under the code fields reads: "Changing a code after the form is in use will not match answers already stored under the old code." (The builder does not know whether a form has been downloaded.)
- **Removing** an option whose code a condition uses is still refused, naming the dependents with jump links.

### 13.9 Import from a file (builder only)

- Offered on every list in §13.1; for `matrix`, rows and columns are imported separately.
- Accepts `.csv` and `.txt`. **The file is read in the browser and never uploaded.** UTF-8; a leading byte-order mark (added by Excel's "CSV UTF-8") is ignored.
- **`.txt`:** each non-blank line is one label.
- **`.csv`:** parsed per RFC 4180 (quoted values may contain commas and quotes).
  - One column: the label.
  - Two columns: code, then label. An empty code is generated in the preview (§13.3).
  - More than two columns: the file is refused with a message.
  - A first row that is exactly `label` or `code,label` (ignoring case and spaces) is a header and skipped.
  - Blank rows are ignored.
- **No size limit.**
- **Preview before applying:** every row is shown with its code (as given, or generated per §13.3 — for **Add**, the existing codes are reserved first) and label, and flagged if it has a missing label, an invalid code, or a duplicate code or label — within the file, and, for **Add**, against the existing options. **Apply is disabled while any row is flagged**; the author fixes the file and chooses it again. Nothing is skipped silently.
- **Add to existing** appends the rows in file order. **Replace all** replaces the list and is refused if it would remove a code used in a condition, naming the dependents. An option whose code appears in the new file keeps its conditions.
- Import changes the editor only; nothing is stored until the author saves.

## 14. Grid block

Agreed 7 Oct 2026. A `grid` is a table of fixed rows and typed columns, where every cell is its own input — e.g. a substance-use history with one row per substance and columns "Age at first use", "Frequency" and "Used in the last 30 days?". It is a separate block type; `matrix` (one choice per row) is unchanged. It corresponds to FHIR's `grid` item control.

### 14.1 Shape

```ts
{ id: string; type: "grid"; label: string; description?: string;
  enableWhen?: EnableWhenCondition[]; enableBehavior?: "any";
  rows: Option[];                 // §13: coded, non-empty
  columns: GridColumn[] }         // non-empty

type GridColumn =
  | { code: string; label: string; type: "radio";    options: Option[]; required?: boolean }
  | { code: string; label: string; type: "dropdown"; options: Option[]; required?: boolean }
  | { code: string; label: string; type: "text";                       required?: boolean };
```

- Rows are a coded list (§13). Columns are coded too: each column's `code` and `label` follow §13.2 and are unique within the grid's columns. Each choice column's `options` are their own coded list, unique within that column.
- `text` is short text, with the same 20,000-character ceiling and whitespace-only-is-empty rule as other free-text answers. More column types (number, date) may be added later.
- **Required is per column.** A required column must be answered in **every row**. There is no grid-level `required`; `required` and `completeRequired` on the grid block itself are ignored.
- A grid may sit anywhere a question may, including inside repeating groups (§12), where it is answered per instance.
- A grid is **not a condition source** (§3.3). It may itself carry `enableWhen`.

### 14.2 Answer and payload

- Browser value (codes only): `Record<rowCode, Record<columnCode, string>>`. A choice cell holds an option code of its column; a text cell holds the text.
- An empty cell is absent. A row with no answered cell is absent. A grid with no answered cell is `empty`.
- `prepareSubmission` returns (§13.5):

```ts
[{ row: { code, label },
   cells: [{ column: { code, label }, value: { code, label } | string }, …] }, …]
```

  answered rows only, in row order; answered cells only, in column order. Choice cells carry `{ code, label }` from the schema; text cells carry the text.

### 14.3 Validation

- Unknown row or column codes, a choice cell whose value is not a code of its column, a non-string cell, or a value of the wrong shape are rejected with the existing vague messages.
- For each required column, every row must have a non-empty cell in that column.
- `ValidationError.path` ends with `[gridId, rowCode, columnCode]` for a cell error.
- **Messages:** each missing required cell is marked on the cell itself ("Required."). The error summary has **one entry per required column** with missing cells, linking to the first one: `"Substance use": answer "Frequency" in every row (3 missing).` Inside repeating groups the usual instance prefix applies (§12.5).

### 14.4 Integrity checks

The builder refuses these at save (400 naming the block); the renderer throws at mount:

- missing or empty `rows` or `columns`;
- a column with an unknown `type`;
- a `radio` or `dropdown` column with a missing or empty `options` list;
- any §13.6 option rule broken in `rows`, in `columns` (code, label, uniqueness), or in a column's `options`.

### 14.5 Rendering (renderer only)

- **Wide layout:** a `<table>` named by the grid's visible label through `aria-labelledby` (no separate `<caption>`, so the label isn't shown twice), with column headers (`scope="col"`) and row headers (`scope="row"`). Required columns show the required marker in their header.
- Every cell input's accessible name is "{row label}, {column label}" (e.g. "Cannabis, Frequency"). A radio cell is a small radio group with that name; each radio is named by its option label.
- **Clearing a radio cell:** choosing a radio cell's selected option again clears the cell. In a column that is not required, a radio cell with an answer also shows a **Clear** button after its radios, named "Clear {row label}, {column label}" (e.g. "Clear Cannabis, Frequency"). It clears that cell only and moves focus to the cell's first radio.
- **Narrow layout:** when the **space available to the grid** is below **34rem**, each row is shown as a card — the row label as a heading, then one labelled field per column. Accessible names are the same in both layouts. The space is measured on the grid itself (a CSS container query on its wrapper), **never the viewport**, because the form may sit in a narrow side panel on a wide screen, or inside nested groups. The grid's breakpoint is lower than the form's own 40rem width on purpose: grids usually sit indented inside groups or repeats, and at 40rem every indented grid would become cards even on a wide desktop.
- **Wide but too wide:** above that breakpoint, if the table is still wider than the space available, the table scrolls horizontally inside its own wrapper. The wrapper is a `role="region"` with `tabindex="0"` and the grid label as its accessible name, so keyboard users can scroll it. The page itself never scrolls sideways because of a grid. Without the package stylesheet, the plain table is shown and these layout rules don't apply.
- Labels are plain text (§13.7).
- **Review page:** each answered row under its row label, with "{column}: {value}" lines; a grid with nothing answered shows "Not answered".
- Public class names include `zf-grid`, `zf-grid-scroll`, `zf-grid-row`, `zf-grid-cell` and `zf-grid-card` (additive; the `classNames` constant stays authoritative).

### 14.6 Builder

- "Grid" is offered in the insert menu. A new grid starts with placeholder rows ("Row 1–3") and one text column ("Column 1"), all with empty codes (§13.3).
- The inspector has a rows editor (the §13 option editor, with import) and a columns editor: for each column its code, label, type, a Required switch, and — for radio and dropdown — its own option editor with import.
- Changing a column between `radio` and `dropdown` keeps its options. Changing a choice column to `text` removes its options, after a confirmation.
- Columns are not imported from files; rows and each choice column's options are (§13.9).
- The canvas preview shows the table.

## 15. Custom condition logic

Agreed 9 Oct 2026. An item's conditions can be combined with any mix of AND and OR, nested to any depth, for example `1 OR (2 AND (3 OR 4))`.

- The author types the logic as text in the builder, using condition numbers.
- The exported form carries a tree, so the renderer never parses text.
- There is no NOT. A hidden source can therefore never make an item visible (§3.5).

### 15.1 Shape

```ts
type EnableWhenCondition = {
  id: string;                    // new: required, unique within this item's enableWhen
  question: string; operator: Operator; answer?: unknown;   // unchanged
};

// On any item that may carry enableWhen (§3.1): questions, groups, pages,
// repeating groups, grid, display blocks
enableWhen?: EnableWhenCondition[];
enableBehavior?: "any";          // flat logic, as today
enableLogic?: LogicNode;         // custom logic; never together with enableBehavior

type LogicNode = { all: LogicItem[] } | { any: LogicItem[] };
type LogicItem = string /* a condition id */ | LogicNode;
```

Example. The text `1 OR (2 AND (3 OR 4))` is exported as:

```json
"enableWhen": [
  { "id": "c1", "question": "phq9_9", "operator": "!=", "answer": "not_at_all" },
  { "id": "c2", "question": "age", "operator": "<", "answer": 18 },
  { "id": "c3", "question": "self_harm_history", "operator": "=", "answer": "yes" },
  { "id": "c4", "question": "recent_discharge", "operator": "=", "answer": "yes" }
],
"enableLogic": { "any": ["c1", { "all": ["c2", { "any": ["c3", "c4"] }] }] }
```

- **Condition ids** follow the §13.2 code pattern (`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`).
  - The builder generates them; they are never shown to authors.
  - They stay stable for the condition's lifetime and are never reused within the item.
  - They are unique within one item only. The same id on two different items is fine.
- **The order of `enableWhen` is the condition numbering** the author sees: the first condition is 1. Conditions cannot be reordered (§15.6).
- `enableLogic` is a tree:
  - Each node has exactly one key, `all` or `any`, holding a non-empty list.
  - A list item is either a condition id or another node.
  - Nesting depth is unlimited.
  - The same id may appear more than once, e.g. `(1 AND 2) OR (1 AND 3)`.
- **The builder exports the simplest form** (§15.4):
  - all-AND logic exports with no `enableLogic` and no `enableBehavior`;
  - all-OR logic exports as `enableBehavior: "any"`;
  - only genuinely mixed logic exports `enableLogic`.

  Simple forms therefore keep FHIR's flat `enableWhen` shape. `enableLogic` is this product's extension; FHIR's own route to complex logic is a FHIRPath expression (`enableWhenExpression`), which we don't use.
- No `schemaVersion` change; nothing has been released.

### 15.2 Evaluation (`/core`)

1. Each condition is evaluated exactly as today. This covers operators, codes (§13.4), a hidden source counting as false (§3.5), and resolution in the dependent's repeat instance (§12.3).
2. `{ all: [...] }` is true if and only if every item in it is true. `{ any: [...] }` is true if and only if at least one item is true.
3. With `enableLogic`, the item's own conditions pass if and only if the root node is true. Without it, `enableBehavior` applies as today.
4. Visibility still also requires every ancestor to be visible (§3.4).
5. The walk must not fail on deep nesting. Use the shared iterative walker or an equivalent approach; don't recurse without bound.

### 15.3 Logic text (builder and API, via one shared parser in `packages/form-schema`)

The text exists only in the builder (§15.6). One parser, shared by the web editor (live checks) and the API (save), turns it into the tree.

**What may be written:**
- Condition numbers `1`…`n`, where `n` is the number of conditions. No leading zeros.
- The words `AND` and `OR`, in any letter case.
- `(` and `)`.
- Spaces, which are optional next to brackets and required between a number and a word. So `(1 AND 2)OR 3` is valid; `1AND2` is not.

**Rules:**
- Operators and numbers must alternate: number or bracketed part, then operator, then number or bracketed part, and so on.
- **AND and OR may not be mixed at the same bracket level.** `1 AND 2 OR 3` is an error; `(1 AND 2) OR 3` is valid. Authors never need to know operator precedence.
- Every condition from 1 to `n` must appear at least once. A condition may appear more than once.
- Redundant brackets are allowed: `((1 AND 2))`, `(1)`.

**Building the tree:**
1. Each bracket level becomes a node: `all` for AND, `any` for OR.
2. A bracketed part with no operator, e.g. `(1)`, is replaced by its content.
3. A node whose operator matches its parent's is merged into the parent: `1 AND (2 AND 3)` → `{ all: [c1, c2, c3] }`.
4. A repeated id inside the same node is kept once: `1 AND 1 AND 2` → `{ all: [c1, c2] }`.

### 15.4 What is exported

After the tree is built:
- A root `all` node that lists every condition exactly once and contains no nested nodes → export `enableWhen` only.
- The same with a root `any` node → export `enableWhen` with `enableBehavior: "any"`.
- Anything else → export `enableWhen` plus `enableLogic`.
- An item with a single condition never has `enableLogic`.

### 15.5 Errors

**Text errors** (builder only). These are shown live under the logic field and also block save. They are checked in this order, and only the first one is shown:

| Problem | Message |
|---|---|
| Field empty, with 2 or more conditions | Enter how the conditions combine, e.g. 1 AND 2. |
| Anything other than numbers, AND, OR, brackets and spaces | "{token}" isn't allowed. Use condition numbers, AND, OR and brackets. |
| Missing operator, e.g. `1 2` or `1 (2 OR 3)` | Add AND or OR between 1 and 2. |
| Missing condition, e.g. `1 AND`, `AND 1` or `1 AND OR 2` | Add a condition after AND. / Start with a condition number. |
| `()` | Brackets can't be empty. |
| Unclosed `(` | A bracket isn't closed. |
| `)` with no matching `(` | There's a closing bracket without an opening one. |
| Mixed AND and OR at one level | Add brackets to show whether AND or OR comes first. |
| A number that isn't a condition, or a leading zero | There's no condition 5. |
| Conditions not used | Condition 3 isn't used. / Conditions 3 and 4 aren't used. |

**Integrity checks** on the exported shape. The builder refuses these at save (400 naming the block); the renderer throws at mount:
- a condition without an `id`, with an id outside the pattern, or with a duplicate id within the item;
- `enableLogic` together with `enableBehavior`;
- `enableLogic` on an item with fewer than 2 conditions;
- a node without exactly one key `all` or `any`, or with an empty list;
- a list item that is neither a string nor a node;
- an id that doesn't match a condition of the item;
- a condition that isn't referenced anywhere in `enableLogic`.

The renderer **accepts** single-item nodes and nested nodes with the same operator as their parent, which a hand-edited schema might contain. They are valid logic, even though the builder never exports them.

### 15.6 Builder

- **Condition list.** The "Show this question only when…" panel lists conditions numbered 1…n, in order. **Conditions cannot be reordered.** Any existing move controls on conditions are removed.
- **Logic field.**
  - It appears when a second condition is added, pre-filled with `1 AND 2`. It replaces the any/all choice.
  - It is labelled "Logic", with the hint "Use condition numbers, AND, OR and brackets, e.g. 1 AND (2 OR 3)".
  - It disappears, and its text is discarded, when only one condition is left.
- **The author's exact text is kept.**
  - It is stored as `enableLogicText` in the builder's saved form content. It is never part of the downloaded artifact, which carries only the tree (§15.4).
  - The builder never rewrites brackets, spacing, word case or order, with one exception: **after a deletion, it lowers every number above the deleted one by one** (e.g. `1 OR 3` becomes `1 OR 2`).
- **The text is the source of truth.**
  - At save, the API parses `enableLogicText` with the shared parser and derives `enableBehavior` and `enableLogic` from it; the order of `enableWhen` is never changed. Any tree sent by the client is ignored.
  - A form whose stored content has a tree but no text (e.g. created through the API) gets text generated from the tree, using numbers in list order, words in upper case, and every nested node in brackets.
- **Adding a condition** leaves the text untouched. The field then shows "Condition 3 isn't used." until the author adds it.
- **Deleting a condition** whose number appears anywhere in the text is refused with: "Condition 2 is used in the logic. Remove it from the logic first." The check scans the text for that number even when the text has other errors.
- **Showing errors.** Errors appear after the author pauses typing. They are shown as:
  - a red border;
  - an error icon;
  - the message under the field, never colour alone.

  The field has `aria-invalid`, and `aria-describedby` pointing at the hint and the error. The message sits in a polite live region. Save shows the same message and refuses, following the existing save-check pattern.
- **Existing guards are unchanged.** These include refusing deletes and moves that would break a source, the source picker (ordering and prefix rules), and code renames rewriting condition answers (§13.8). They apply to every condition, whatever the logic.
- Text that is valid but redundant, e.g. `((1 AND 2))`, is saved as written and exported in its simplest form.

### 15.7 Shared test table

Both repos test the tree and export cases (`/core` evaluation, renderer integrity). The builder tests the text cases.

**Valid text → exported**, with 4 conditions unless stated:

| Text | Exported |
|---|---|
| `1 AND 2 AND 3 AND 4` | flat, no `enableBehavior` |
| `1 or 2 or 3 or 4` | flat, `enableBehavior: "any"` |
| `1 OR (2 AND (3 OR 4))` | `{ any: [c1, { all: [c2, { any: [c3, c4] }] }] }` |
| `(1 AND 2) OR (1 AND 3) OR 4` | `{ any: [{ all: [c1, c2] }, { all: [c1, c3] }, c4] }` |
| `((1 AND 2)) AND (3 AND 4)` | flat, no `enableBehavior` |
| `(1 AND 2)OR(3 AND 4)` | `{ any: [{ all: [c1, c2] }, { all: [c3, c4] }] }` |
| 2 conditions: `(2) AND 1` | flat, no `enableBehavior` |

**Invalid text → message:**

| Text | Message |
|---|---|
| `1 AND 2 OR 3 AND 4` | Add brackets to show whether AND or OR comes first. |
| `1 AND (2 OR 3` | A bracket isn't closed. |
| `1 AND 2) OR 3` | There's a closing bracket without an opening one. |
| `1 AND 2 AND 3` | Condition 4 isn't used. |
| `1 AND 2 AND 3 AND 5` | There's no condition 5. |
| `1 AND 02 AND 3 AND 4` | There's no condition 02. |
| `1 XOR 2` | "XOR" isn't allowed. Use condition numbers, AND, OR and brackets. |
| `1 2 AND 3 AND 4` | Add AND or OR between 1 and 2. |
| `1 AND () AND 3` | Brackets can't be empty. |
| `1AND2 AND 3 AND 4` | "1AND2" isn't allowed. Use condition numbers, AND, OR and brackets. |
| `NOT 1 AND 2` | "NOT" isn't allowed. Use condition numbers, AND, OR and brackets. |

## 16. Host validators

Agreed 13 Oct 2026. The host's developers can add their own validation to any answerable question, written as JavaScript functions in the host's own code. Nothing about them appears in the schema or the builder. The package runs them with the same rules as its built-in checks, in the browser and in `prepareSubmission`.

Author-written rules (regex or "show this error when…") are **not** part of this section.

### 16.1 Host API (renderer only)

```ts
type FieldValidator = {
  field: string;                                    // block id of an answerable question
  validate: (input: ValidatorInput) => string | null | undefined;
};

type ValidatorInput = {
  value: unknown;              // this question's answer (see 16.3)
  answers: ValidatorAnswers;   // visible answers in this question's context (see 16.3)
  field: string;               // the block id, as in FieldValidator.field
  path: (string | number)[];   // as ValidationError.path (§12.5), e.g. ["patients", 1, "mrn"]
};

type ValidatorAnswers = Record<string, unknown>;    // block id → answer value

<FormRenderer validators?: FieldValidator[] … />
prepareSubmission(schema, payload, options?: { validators?: FieldValidator[] })
validateSubmission(schema, answers, options?: { validators?: FieldValidator[] })
```

- `validate` is a function **reference**. The package never looks functions up by name and never evaluates code from text.
- The host passes the **same array** to `FormRenderer` and to `prepareSubmission`, normally by importing one shared module in both places. If it isn't passed to `prepareSubmission`, the host's rules are not enforced on the server. The README states this plainly.
- Several entries may name the same field. They run in array order.

### 16.2 Checks on the array (throw)

The renderer throws at mount, and again whenever the `validators` prop changes to a different array. `prepareSubmission` and `validateSubmission` throw when called. Each error is a `TypeError` naming the entry's position and field:
- `validators` is present but not an array;
- an entry is not a plain object, or has no string `field`, or no function `validate`;
- `field` is not the id of a block in the schema;
- `field` names a block that is not an answerable question (a group, page, presentational or display block, or `hidden`).

### 16.3 What the function receives

- **Values** are in payload form, with the `{ state, value }` wrapper removed:
  - numbers as numbers;
  - coded answers as codes, never labels;
  - dates as `"YYYY-MM-DD"`;
  - `checkbox`, `multiselect` and `ranking` as arrays of codes;
  - `matrix` as `Record<rowCode, columnCode>`;
  - `grid` as `Record<rowCode, Record<columnCode, string>>`.
- **`value` is always present and well-formed** (see 16.4).
- **`answers`** holds every **visible**, answered question in this question's context that passes its own built-in checks (§16.4, item 3), keyed by block id. An empty or hidden question, or one failing a built-in check, is absent, so every value a validator sees is well-formed. Inside a repeating group, `answers` contains:
  - the questions of the same instance;
  - the questions of every enclosing instance;
  - questions outside any repeat.

  Questions inside repeats that don't enclose this question are absent, as with the prefix rule (§3.7, §12.3).
- `answers` and `value` are copies; changing them has no effect.

### 16.4 When a validator runs

A host validator runs for a question only when **all** of these hold:
1. the question is visible (in that instance's context, §12.3);
2. the question is answered (not empty);
3. the question passes **every built-in check** for its type: format, option membership, min/max, length ceiling, and `completeRequired` / grid required columns.

It runs at the same moments as the built-in checks: Next, Submit, Return to review, final re-validation, and inside `validateSubmission` and `prepareSubmission`. It runs **once per repeat instance**.

### 16.5 Results

- `null` or `undefined` means valid.
- A **non-empty string** is an error message. It is trimmed and shown as **plain text**: on the question (the existing `…__error` element, `aria-invalid`, `aria-describedby`) and in the error summary, with the usual instance prefix (§12.5). For a `grid`, it is shown on the grid as a whole, not on a cell.
- The error appears in `ValidationError[]` like any other, with `blockId` and `path` set as for built-in errors.
- Several failing validators on one question all show, in array order, after any built-in errors. `ValidationError[]` contains every one, but identical messages on one question are shown only once, on the question and in the error summary.

### 16.6 Failures fail closed

The question is treated as **invalid**, with the message **"This answer couldn't be checked."**, when a validator:
- throws;
- returns anything other than `null`, `undefined` or a non-empty string, including an empty or whitespace-only string, a number, an object or a `Promise`.

Async validators are not supported in this version, so a `Promise` counts as a bad return value.

- **In the browser,** the real exception or bad value is logged with `console.error`, naming the field. The respondent sees only the message above.
- **On the server,** that `ValidationError` carries the original exception or value as a **non-enumerable** `cause`, like `Error.cause`. The host can read and log it, but `JSON.stringify` never includes it, so exception details can't leak if a backend returns the errors to the browser.

### 16.7 Out of scope (this version)

- warnings (soft checks that don't block);
- async validators (network lookups);
- validators written by authors in the builder, including regex rules.

## 17. Scoring

Agreed 15 Oct 2026. A group can carry one or more **scores**, each calculated from a formula over the group's questions, e.g. a questionnaire total (`q1 + q2 + … + q9`) or a weighted value (`(mood + sleep) * days`).

- Options carry a numeric `score`. Number, scale and rating questions give their own value.
- The author types the formula in the builder using short question names. The exported form carries a tree that refers to block ids, so the renderer never parses text (as §15).
- Scores are always recalculated by `prepareSubmission` on the server. The browser never sends them.
- Modelled on FHIR's option weights ([`itemWeight`](https://www.hl7.org/fhir/extensions/StructureDefinition-itemWeight.html)) and SDC's calculated expressions; FHIR uses FHIRPath for the formula, which we don't.
- Not in this version: severity bands, scores as condition sources, aggregates across repeat instances, and option scores imported from files.

### 17.1 Shape

```ts
// Group (plain or repeating), extending §1 and §12.1
scores?: Score[];

type Score = {
  id: string;                        // §13.2 code pattern; unique within this group's scores
  label: string;                     // non-blank, plain text, e.g. "Total score"
  formula: FormulaNode;
  unanswered: "no-score" | "zero";   // §17.3
  decimals?: number;                 // whole number 0–4; default 0
  showToRespondent?: boolean;        // default false; §17.5
};

type FormulaNode =
  | { num: number }                  // a finite number
  | { ref: string }                  // the block id of a question within reach (§17.2)
  | { op: "+" | "-" | "*" | "/"; args: [FormulaNode, FormulaNode] };

// Option, extending §13.1
type Option = { code: string; label: string; score?: number };   // score: a finite number
```

- Scores are allowed on any group, plain or repeating, at any depth. Pages never carry scores.
- `score` is used on the options of `choice`, `dropdown`, `checkbox` and `multiselect`, and on `matrix` **columns**. Anywhere else it is ignored.
- Score ids are unique within one group only, like condition ids (§15.1), so a group inserted twice from a template needs no new score ids.

### 17.2 Reach and what a reference gives

**Reach.** A group's formulas may refer to answerable questions inside the group, including inside its nested **plain** groups at any depth, but **not** inside a nested repeating group. A formula never reaches outside its group.

**Calculated where.** A score is calculated once for each context in which its group appears:
- for a group outside any repeat, once;
- for a repeating group, once **per instance**, over that instance's questions;
- for a plain group inside a repeat, once per instance of the enclosing repeat.

**What a reference gives:**

| Question type | Value |
|---|---|
| `number`, `scale`, `rating` | its numeric answer |
| `choice`, `dropdown` | the chosen option's `score` |
| `checkbox`, `multiselect` | the sum of the chosen options' `score`s |
| `matrix` | the sum, over its rows, of the chosen column's `score` |
| any other type | not allowed in a formula |

Every option (or matrix column) of a referenced coded question must have a `score` (§17.6).

### 17.3 Unanswered questions

A referenced question is **unanswered** when it is hidden, or its state is anything other than `answered`. A `matrix` counts as unanswered when **any** of its rows is unanswered.

- `"no-score"` (the builder's default): if any referenced question is unanswered, the score has no value (`null`, reason `"unanswered"`).
- `"zero"`: an unanswered question counts as 0. For a partly answered matrix, its unanswered rows count as 0.

### 17.4 Calculation (`/core`)

1. If the scored group is hidden in a context (§3.4, §12.3), that score is not calculated there and produces no result.
2. Apply §17.3, then evaluate the tree. `*` and `/` come before `+` and `-` only in the text; the tree is evaluated exactly as structured.
3. Division by zero, or any non-finite result, gives no value (`null`, reason `"invalid"`).
4. Round only the final result to `decimals` places, **half away from zero** (2.5 → 3, −2.5 → −3). Rounding also clears floating-point noise (0.1 + 0.2 with 2 decimals → 0.3).
5. Use the shared iterative walker or an equivalent; a long sum makes a deep tree, so don't recurse without bound (as §15.2).
6. Scores are calculated only for a submission that passes validation. They never produce validation errors.

### 17.5 Results

**Browser payload:** carries no scores. `prepareSubmission` ignores any score-like data in a request.

**`prepareSubmission`** returns the scores it calculated from the schema it was given, alongside the answers:

```ts
derived: { scores: ScoreResult[] }

type ScoreResult = {
  groupId: string;
  scoreId: string;
  label: string;
  path: (string | number)[];         // as §12.5, to the group; ends with the instance position for a repeating group
  value: number | null;
  reason?: "unanswered" | "invalid"; // present only when value is null
};
```

- `derived` is always present on a successful result, as `{ scores: [] }` when the form has no scores.
- Results follow the form's reading order, instance by instance, the same order the error summary uses. Each context lists its group's scores in `scores` order. Example: a repeating group R with scores s1 and s2, containing a scored plain group P, gives R@0 s1, R@0 s2, P@0, R@1 s1, R@1 s2, P@1.
- A hidden group, or a repeating group with no instances, contributes no results.

**Shown to the respondent** only when `showToRespondent` is true, and only **after a successful submit**: never while filling in the form, and never on the review page. The renderer calculates the score in the browser with the same `/core` function, purely for display, and lists each such visible score as "{label}: {value}" in plain text, in a list directly after the success message. `{value}` is the number as calculated, without added trailing zeros (5, not 5.00; 0.67). A `null` score is not shown. Inside a repeat, the label is prefixed with the instance, as in the error summary (§12.5): "Patient 2: Total score: 14".

**Focus after submit (every form, with or without scores):** focus moves to the success message, which takes `tabindex="-1"`, so keyboard and screen-reader users land on it instead of on the page body.

### 17.6 Integrity checks

The builder refuses these at save (400 naming the block); the renderer throws at mount:
- `scores` on a page, or `scores` that is not an array;
- a score without a valid `id`, with a duplicate `id` within its group, or with a blank `label`;
- `unanswered` other than `"no-score"` or `"zero"`; `decimals` not a whole number from 0 to 4; `showToRespondent` not a boolean;
- a malformed node: not exactly one of `num`, `ref`, or `op` with `args`; a `num` that isn't a finite number; an `op` outside `+ - * /`; `args` not exactly two nodes;
- a `ref` that is not the id of a question within reach (§17.2), or names a type that can't be scored;
- a referenced coded question with an option (or matrix column) whose `score` is missing or not a finite number.

### 17.7 Formula text (builder and API, via one shared parser in `packages/form-schema`)

The text exists only in the builder, as `formulaText` on each score in the saved form content. It is never part of the downloaded artifact.

**What may be written:**
- question **names** (§17.8), matched ignoring case;
- numbers: digits, optionally with a decimal point followed by digits (`2`, `0.5`, `10`);
- `+`, `-`, `*`, `/`, `(`, `)` and spaces. Spaces are optional everywhere.

**Rules:**
- Usual maths order: `*` and `/` before `+` and `-`; equal operators left to right. Brackets override. So `q1 + q2 * 2` is `q1 + (q2 * 2)`.
- No unary minus: write `0 - q1` or `4 - q1`.
- At least one question name.
- At most **300 terms** (question names and numbers, counting repeats). Every format the tree passes through (JSON, Postgres `jsonb`) has a nesting limit, and a long sum makes a deep tree; 300 is well inside those limits and above any real questionnaire.

**Building the tree:** each operator becomes a two-argument node, built left to right within each level of precedence. `q1 + q2 + q3` → `{ op: "+", args: [{ op: "+", args: [q1, q2] }, q3] }`.

**Errors**, shown live under the field and blocking save, checked in this order, only the first shown:

| Problem | Message |
|---|---|
| Empty | Enter a formula, e.g. q1 + q2. |
| Anything other than names, numbers, operators, brackets and spaces | "{token}" isn't allowed. Use question names, numbers, + - * / and brackets. |
| Missing operator, e.g. `q1 q2` or `2 q1` | Add an operator between q1 and q2. |
| Missing operand, e.g. `q1 +`, `* q1`, `-q1` | Add a name or number after +. / Start with a question name, a number or a bracket. |
| `()` | Brackets can't be empty. |
| Unclosed `(` | A bracket isn't closed. |
| `)` with no matching `(` | There's a closing bracket without an opening one. |
| A name not within reach | There's no question named "{name}" in this group. |
| A name inside a nested repeating group | "{name}" is in a repeating group, so this score can't use it. |
| A name of a type that can't be scored | "{name}" can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions. |
| No names | Use at least one question name. |
| More than 300 terms | This formula is too long. Use at most 300 question names and numbers. |

At save, the API parses `formulaText` and derives `formula`; any tree sent by the client is ignored. A score with a tree but no text (e.g. created through the API) gets text generated from it, with names, single spaces around operators, and brackets only where needed (a negative number is written as `(0 - 2)`). Such a tree with more than 300 terms is refused with the same "too long" message.

### 17.8 Question names (builder only)

- Every answerable question within reach of a group that has a score has a short **name**, used only in formula text. It is stored as `name` in the builder's saved content and stripped from the artifact.
- **Pattern:** `^[a-z][a-z0-9_]{0,63}$`.
- **Unique** within the reach of every scored group that reaches the question.
- **Generated** when empty, at the same moments as codes (§13.3): for a **new** question, when the author leaves its label field after changing it (so the name comes from the real label, not the placeholder); for an existing question, as soon as it comes within reach of a scored group; and at save. Steps:
  1. Take the label; normalise it (NFKD) and remove accents; lower-case it.
  2. Replace each run of whitespace with `_`; remove every character other than `a–z`, `0–9`, `_`; collapse repeated `_`; trim `_` from both ends.
  3. If it starts with a digit, prefix `q_`.
  4. If longer than 32 characters, cut at the last `_` within the first 32; if there is none, cut at 32.
  5. If nothing is left, use `q{n}`, where `n` is the question's number (§4).
  6. If it clashes, append `_2`, `_3`, … (the first free one).
- A name is generated once and never regenerated; label edits don't change it.

| Label | Name |
|---|---|
| `Age` | `age` |
| `Little interest or pleasure in doing things` | `little_interest_or_pleasure_in` |
| `1. Feeling nervous` | `q_1_feeling_nervous` |
| `焦虑` (question 7) | `q7` |
| `Age` when `age` is taken | `age_2` |

### 17.9 Builder

- **Scores panel** in the group inspector: a list of scores, each with Label, Formula (hint: "Use question names, numbers, + - * / and brackets, e.g. q1 + q2"), "If a question is unanswered" (**No score** / Count as 0), Decimal places (0–4) and a "Show to respondent after submit" switch. Errors are shown as in §15.6 (border, icon, message, `aria-invalid`, polite live region).
- **Names** are shown and editable in the inspector of every question within reach of a scored group, checked against §17.8 inline and at save.
- **Option scores:** the option editor (and the matrix columns editor) shows a Score field for questions within reach of a scored group. Scores on a question that leaves reach are kept, not shown. On import (§13.9), **Replace all** keeps the score of every option whose code appears in the new file, as it keeps its conditions; **Add** rows come in without scores.
- **Score ids** are generated by the builder and never shown, like condition ids (§15.1). A score sent to the API without an id gets one at save; a score sent again keeps its id.
- **Guards**, following the existing pattern (refuse, naming the dependents with jump links):
  - **renaming** a question rewrites every formula text that uses the name, and says how many were updated;
  - **deleting** a question a formula uses is refused: `Used in the score "Total score" of "PHQ-9". Remove it from the formula first.`;
  - **changing the type** of a referenced question to one that can't be scored is refused;
  - **moving** a referenced question out of reach, or turning a nested plain group that holds one into a repeating group, is refused;
  - **removing an option score** a formula needs is a save error naming the question and the score.
- **Name clashes on move:** moving a question into another scored group's reach where its name is already taken gives it the §17.8 suffix, and rewrites only the formula texts that referred to that question.
- **Templates:** id remapping also remaps every `ref`. Names and formula text are copied unchanged. If an inserted copy's names clash within an enclosing scored group's reach, the copy's names get the §17.8 suffix and its own formula texts are rewritten to match.

### 17.10 Shared test table

Both repos test the tree cases (`/core` calculation, renderer integrity). The builder tests the text cases.

With `q1` = 2, `q2` = 3 (number questions) unless stated:

| Formula | Settings | Result |
|---|---|---|
| `q1 + q2` | | 5 |
| `(q1 + q2) * 2` | | 10 |
| `q1 + q2 * 2` | | 8 |
| `q1 / q2` | 2 decimals | 0.67 |
| `q1 - q2` | | −1 |
| `q1 / (q2 - 3)` | | null, `invalid` |
| `q1 + 0.5` | 0 decimals | 3 (2.5 rounds away from zero) |
| `0 - q1 - 0.5` | 0 decimals | −3 |
| `q1 + q2`, `q2` unanswered | `no-score` | null, `unanswered` |
| `q1 + q2`, `q2` unanswered | `zero` | 2 |
| `q1 + q2`, `q2` hidden | `zero` | 2 |
| `c`: checkbox, options scored 1, 2, 4; first two chosen | | 3 |
| `m`: matrix, 3 rows, columns scored 0–3; two rows answered with columns scored 1 and 2, one row unanswered | `no-score` | null, `unanswered` |
| same | `zero` | 3 |
| scored repeating group, 2 instances, `q1` = 2 and 5 | | two results, 2 and 5, paths ending 0 and 1 |