# Groups and Pages — Schema Contract

Status: agreed 25 Sep 2026; amended 5 Oct 2026 for repeating groups (§12, with matching changes in §1–§8); amended 6 Oct 2026 for coded options and option import (§13); amended 7 Oct 2026 for the grid block (§14). Shared by the builder repo and the `@yourco/forms` renderer repo.
Both implementations must follow this file exactly. Change it here first, then in both repos.

## 1. Shapes

```ts
// Group — any depth, at the root or inside a page/group
{ id: string; type: "group"; label: string;
  enableWhen?: EnableWhenCondition[]; enableBehavior?: "any";
  repeats?: boolean; repeatLabel?: string;     // repeating group, see §12
  minOccurs?: number; maxOccurs?: number;      // repeating group, see §12
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
- Groups and pages have no value, no `required`, no `completeRequired`.

## 2. Structure rules

1. Groups nest to **any depth**. There is no depth limit.
2. `page` may appear only at the root — never inside a group or another page.
3. If any root item is a page, **every** root item must be a page (no mixed root).
4. Block ids are unique across the whole tree, including group and page ids.
5. `label` (group) and `title` (page) are required and non-blank. The builder defaults them to "Untitled group" / "Untitled page".
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

## 4. Numbering

- Continuous 1…n in reading order across the whole tree.
- Only answerable questions are numbered. Groups, pages and presentational blocks are not.
- Numbers are static: hiding does not renumber (gaps are expected).
- Numbering is shown in the **builder only** (canvas and condition-source picker). The renderer does not display question numbers.
- Questions inside a repeating group are numbered once, as they appear in the template.

## 5. Payload

`answers` stays a flat map keyed by block id. Groups and pages contribute nothing. **Exception:** a repeating group contributes an array of instance objects under its own id (§12.4).
The payload filter now walks the tree and keeps only **visible answerable questions**. Unknown ids, groups, pages and presentational blocks are dropped. "Answerable" is one list in `/core`, shared by validation and the payload filter.

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

`repeatLabel`, `minOccurs` and `maxOccurs` on a group without `repeats: true` are ignored, not rejected.

## 7. Rendering (renderer only)

- Group → `<fieldset>` with a `<legend>` containing the label as a heading.
- Heading level: in a single-page form, root-level groups use `h2`; in a paged form the page title is `h2` and its root-level groups `h3`. Each nesting level adds one, **capped at `h6`** (nesting continues; only the level stops rising). Author heading blocks keep their own `level`.
- Public class names include `yf-group`, `yf-group-legend`, `yf-page`, `yf-page-title`, `yf-nav`, `yf-next`, `yf-back`, `yf-progress`, `yf-progress-bar`, `yf-review` (additive under the existing class-name policy, which starts at the first release to a client). This list is not exhaustive; the renderer's `classNames` constant and its contract test are the complete, authoritative list.
- Repeating groups render as described in §12.6.

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
- **Progress bar:** when `progressStyle` is `"bar"`, a display-only segmented bar appears above the caption — one segment per step: completed, current, pending — hidden from assistive technology, never clickable. The caption always stays. The host can override the author's choice either way with `data-yf-progress-style="bar"` or `"caption"` on any wrapper; the host's attribute wins. The bar is only shown when the package stylesheet is loaded.
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
  maxOccurs?: number;       // whole number ≥ 1 and ≥ minOccurs; absent = no limit
  enableWhen?: EnableWhenCondition[]; enableBehavior?: "any";
  blocks: Block[] }         // the template for one instance
```

- A repeating group is a `group` with `repeats: true`. It follows every group rule in §2 unless this section says otherwise.
- `label` is the section heading for the whole list (e.g. "Patients"). `repeatLabel` names one instance.
- `repeatLabel` is used **verbatim** in buttons and messages ("Add another patient") and with its **first character upper-cased** in headings and the error summary ("Patient 2"). The builder tells authors to write it as it should appear mid-sentence (lower case unless it is a proper noun or acronym).
- When "Repeats" is turned on, the builder writes `minOccurs: 1` and a `repeatLabel` of "item"; the author can change both.
- **Nesting:** repeating groups may contain plain groups and other repeating groups, to any depth. A repeating group may sit anywhere a group may (root of a single-page form, inside a page, inside any group). Pages never repeat.
- Instances have internal ids (stable for the instance's lifetime, never derived from position). They never appear in the schema, the payload or drafts.

### 12.2 Instances

- The form starts with `minOccurs` instances. With `minOccurs: 0` it starts with none, showing only the Add button.
- **Add** appends one instance at the end. Its text is "Add {repeatLabel}" when there are no instances and "Add another {repeatLabel}" otherwise.
- At `maxOccurs`, Add is disabled and the text "You can add up to {maxOccurs}." is shown next to it. When an Add reaches the limit, that text is also announced through the repeat's polite status region, since focus has moved to the new instance and a disabled button is not focusable.
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
- `prepareSubmission` and `validateSubmission` also reject a repeating group's value that is not an array, or an instance that is not an object, with the same vague message. They strip hidden and unknown answers per instance, as at the root.
- `ValidationError` gains `path: (string | number)[]`: block ids and 0-based instance positions from the root to the question, e.g. `["patients", 1, "payments", 0, "amount"]`. For a question outside any repeat, `path` is `[blockId]`. `blockId` stays as it is.
- In the browser, the error summary puts the enclosing instances, outermost first, in front of the existing message, which already names the question: `Patient 2, Payment 1: "Amount" is required.`

### 12.6 Rendering (renderer only)

- The repeating group renders as a `<fieldset>` with its `label` in the `<legend>`, as a heading (§7).
- Each instance is a nested `<fieldset>` whose `<legend>` holds "{RepeatLabel} {n}" as a heading one level below the group's, capped at `h6`.
- Each instance's Remove button shows "Remove". Its accessible name is "Remove {repeatLabel} {n}", and inside a nested instance it also names **every** enclosing instance, outermost first, so no two buttons on the page share a name: "Remove payment 1 from patient 2", "Remove line item 1 from patient 2, payment 1". The Add button inside a nested instance is named the same way: "Add another payment to patient 2", "Add another line item to patient 2, payment 1". The visible text always begins the accessible name (WCAG 2.5.3).
- Element ids and error ids (`…__error`) are built from the instance ids along the path, never from positions, so they stay stable when an instance above is removed.
- **Focus:** after Add, focus moves to the new instance's heading. After Remove, focus moves to the previous instance's heading; if there is none, to the instance that took its place; if none remain, to the Add button. A polite `role="status"` region announces "{RepeatLabel} {n} removed."
- **Review page:** each instance is listed under its own subheading ("{RepeatLabel} {n}"), with nested instances nested the same way. A visible repeating group with zero instances shows "None added". An instance whose questions are all hidden still shows its subheading, so the numbering matches the form.
- Public class names include `yf-repeat`, `yf-repeat-instance`, `yf-repeat-legend`, `yf-repeat-add`, `yf-repeat-remove`, `yf-repeat-limit` and `yf-repeat-status` (additive, under the existing policy; the renderer's `classNames` constant stays authoritative).

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
type Option = { code: string; label: string };
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

- **Wide layout:** a `<table>` with the grid label as its caption, column headers (`scope="col"`) and row headers (`scope="row"`). Required columns show the required marker in their header.
- Every cell input's accessible name is "{row label}, {column label}" (e.g. "Cannabis, Frequency"). A radio cell is a small radio group with that name; each radio is named by its option label.
- **Narrow layout:** below the stylesheet's narrow breakpoint, each row is shown as a card — the row label as a heading, then one labelled field per column. Accessible names are the same in both layouts.
- Labels are plain text (§13.7).
- **Review page:** each answered row under its row label, with "{column}: {value}" lines; a grid with nothing answered shows "Not answered".
- Public class names include `yf-grid`, `yf-grid-row`, `yf-grid-cell` and `yf-grid-card` (additive; the `classNames` constant stays authoritative).

### 14.6 Builder

- "Grid" is offered in the insert menu. A new grid starts with placeholder rows ("Row 1–3") and one text column ("Column 1"), all with empty codes (§13.3).
- The inspector has a rows editor (the §13 option editor, with import) and a columns editor: for each column its code, label, type, a Required switch, and — for radio and dropdown — its own option editor with import.
- Changing a column between `radio` and `dropdown` keeps its options. Changing a choice column to `text` removes its options, after a confirmation.
- Columns are not imported from files; rows and each choice column's options are (§13.9).
- The canvas preview shows the table.