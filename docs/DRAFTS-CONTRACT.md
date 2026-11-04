# Drafts — Contract

Status: agreed 29 Sep 2026; amended 29 Sep 2026 after renderer Checkpoint 0; amended 5 Oct 2026 for repeating groups (§5, §8); amended 15 Oct 2026 for the package rename (§3, §5); amended 30 Oct 2026 for hashing without Web Crypto (§4, §5), the failed-save notice (§4, §6) and `clearDrafts` rejecting when it can't clear (§3, §8); amended 30 Oct 2026 for shared devices: the `off` mode, `scope` and `owner` in session mode, the session-mode tab copy and when it restores (§2, §3, §5, §6, §7, §8, §9); amended 30 Oct 2026 so Start over moves focus to the start of the form (§7); amended 4 Nov 2026 for `clearDrafts` rejecting with a `TypeError` (§3) and the sweep of a form's other versions in the tab, matching its `formId` exactly (§5, §8). Shared by the builder repo and the `@zoworkhq/forms` renderer repo.
Change it here first, then in both repos.

## 1. Purpose

Let a respondent close the browser part-way through a long form and continue later **on the same device**, without the form package ever holding PHI itself and without knowing how the host app authenticates users.

## 2. Modes (author's choice, stored in the schema)

```ts
drafts?: { mode: "session" | "device" | "server" }   // default "session"
```

| Mode | Where the draft lives | Survives a closed tab | Host must provide |
|---|---|---|---|
| `session` | the tab's `sessionStorage`, visible answers only (§5) | No | nothing (`scope` and `owner` optional, §3.1) |
| `device` | IndexedDB, encrypted | Yes, same device | `scope` + `getKey` |
| `server` | the host's own backend | Yes | `scope` + `loadDraft` / `saveDraft` / `deleteDraft` |
| `off` | nowhere | No, nor a refresh | `drafts={{ mode: 'off' }}` |

- `server` is only offered for **paged forms** (it saves on page changes). The builder enforces this; if pages are later removed, the setting reverts to `session` with a note to the author.
- The exported artifact carries `drafts` only when the mode is not `session`.
- `off` is the **host's** choice, never the schema's; the builder never exports it. It overrides whatever mode the schema asks for: the form reads and writes nothing in `sessionStorage`, IndexedDB or the host's backend, looks up no draft, and reports no drafts problem. A refresh starts a new form. It is meant for kiosks and other shared devices where nothing may be kept.

## 3. Host API (renderer)

```ts
<FormRenderer
  drafts={{
    mode?: "off",                                   // store nothing anywhere (§2); overrides the schema's mode
    scope?: string,                                 // opaque; see 3.1. Required for device and server modes
    owner?: string,                                 // opaque; the user; see 3.1. Needed for clearDrafts({ owner })
    label?: string,                                 // shown in the restore prompt, e.g. "J. Smith"
    getKey?: () => Promise<CryptoKey>,              // device mode; AES-GCM 256
    expiresAfterDays?: number,                      // device mode; default 7; sliding (each save sets expiresAt = now + days)
    loadDraft?: (ref: DraftRef) => Promise<Draft | null>,   // server mode
    saveDraft?: (draft: Draft) => Promise<void>,            // server mode
    deleteDraft?: (ref: DraftRef) => Promise<void>,         // server mode
  }}
  onDraftProblem?: (problem: DraftProblem) => void   // see §4; separate from onError, which stays submit-only
/>

type DraftRef = { scope: string; formId: string };

// Exported from @zoworkhq/forms/react, for the host to call, e.g. on logout:
clearDrafts(options?: { scope?: string; owner?: string }): Promise<void>
//   { owner }  -> every draft recorded with that owner, across all scopes and forms (the normal logout call)
//   { scope }  -> every draft for that scope, across all forms
//   no options -> every draft on this device, and every tab entry the package wrote in this tab
//   { scope, owner } together, or a non-object argument -> rejects with a TypeError (it is async: nothing is thrown synchronously;
//     ambiguous, and a mistake here deletes drafts)
//   rejects with ClearDraftsError when it can't delete what it was asked to (see §8); it never resolves without clearing
```

### 3.1 `scope`
- Opaque to the package; never interpreted.
- Must identify **the user**, and **the subject** (patient, visit, episode) whenever the same form is filled for more than one subject. Example: `` `${userId}:${patientId}` ``. Getting this wrong can restore one patient's answers into another patient's form.
- `owner` is also opaque and should identify only **the user** (e.g. `userId`). It lets the host clear all of one user's drafts at logout without knowing which subjects they have drafts for. Recommended wherever a device may be shared.
- In `session` mode both are optional. When given, they key and tag the tab's copy (§5) exactly as in device and server modes, so a different user or subject in the same tab never receives it, and `clearDrafts({ scope })` or `clearDrafts({ owner })` finds it.
- Both are read once, when the form mounts. To switch to another user or subject, mount the form afresh (for example with a new React `key`).

### 3.2 Key (device mode)
- Supplied by the host after the user logs in, e.g. from a per-user key the host's server holds or derives. The package never generates, stores or exports it.
- A key that fails to decrypt a draft (e.g. rotated) is treated as "no usable draft": the draft is deleted and the respondent sees: "Your saved draft couldn't be opened, so you're starting a new form."

## 4. Problems and fallbacks — never block the form

Draft problems are reported through `onDraftProblem`, never `onError`. With `mode: 'off'` nothing is reported: there are no drafts.

```ts
type DraftProblem = {
  type: "drafts-unavailable" | "draft-unreadable" | "draft-save-failed" | "draft-load-failed" | "draft-delete-failed";
  mode: "device" | "server";
  reason?: "no-scope" | "no-getKey" | "missing-server-functions" | "not-paged" | "no-indexeddb" | "no-webcrypto";
  error?: unknown;
};
```

| Situation | Behaviour |
|---|---|
| `device`, but no `scope` or no `getKey` | fall back to `session`; report `drafts-unavailable` once per mount |
| `server`, but no `scope` or any of the three functions missing | fall back to `session`; same |
| `server` on a form without pages | fall back to `session`; same |
| `device`, and IndexedDB or Web Crypto encryption unavailable (for example on a plain-HTTP page, which has no `crypto.subtle`) | fall back to `session`, keeping the scope (§5); report `drafts-unavailable` once per mount, reason `no-indexeddb` or `no-webcrypto` |
| `loadDraft` fails on mount | fall back to `session` for that mount, so an existing server draft is never overwritten; report `draft-load-failed`; show the notice "Your progress can't be saved for later on this visit." |
| `getKey` fails (device mode) | same as `loadDraft` failing: fall back to `session` for that mount, leave the device draft untouched, report `draft-load-failed`, show the same notice |
| A save fails (either mode) | report `draft-save-failed`; show the non-blocking notice (§6). Nothing is retried in the background: the next save point (§6) saves the current answers again |
| A delete fails (either mode) | report `draft-delete-failed`; no notice to the respondent. The draft may be offered again in a later fresh tab; its restored idempotency key lets the host's backend reject a duplicate submission. |

## 5. What a draft contains

```ts
type Draft = {
  formId: string; formVersionId: string; schemaVersion: number;
  answers: DraftAnswers;                     // including hidden answers, as today
  idempotencyKey: string;                    // so a resumed form cannot create a duplicate
  currentPageId?: string; visitedPageIds?: string[]; onReview?: boolean;
  savedAt: string;                           // UTC ISO-8601
};

// A repeating group (GROUPS-AND-PAGES-CONTRACT §12) is stored as an array of instances,
// in display order, each with its own answers. Instance ids are not stored; they are
// regenerated on restore.
type DraftAnswers = Record<string, BlockValue | DraftAnswers[]>;
```

### Device storage format
- IndexedDB database `zoworkhq-forms-drafts`, one record per `(scope, formId)`.
- Record key: hex SHA-256 of `scope` + a separator character that can't appear in the hash input ambiguously (e.g. U+0000) + `formId`.
- Record value: `{ scopeHash, ownerHash?, iv, ciphertext, expiresAt }`, with indexes on `scopeHash` and `ownerHash` (each a hex SHA-256 of `scope` / `owner`), so `clearDrafts` can find every matching draft across forms. `ownerHash` is present only when the host supplied `owner`.
- `ciphertext` is the AES-GCM encryption of the whole `Draft` with a fresh 96-bit IV per save. `expiresAt` stays in clear so expired records can be swept without a key.
- **Hashes without Web Crypto.** Every hash here (record keys, `scopeHash`, `ownerHash`) is SHA-256 of the UTF-8 text, from Web Crypto where it exists and from the package's own SHA-256 where it doesn't (a plain-HTTP page has no `crypto.subtle`). Both give the same hex, so a scope keys the tab's entry, and `clearDrafts` finds it, on any page. Server mode needs nothing else from Web Crypto and works on plain HTTP; device mode still needs it to encrypt (§4).

### The tab's copy (every mode but `off`)
Every mode keeps a copy of the fill in the tab's `sessionStorage`, so a refresh never depends on the network or the key (§6, §7).
- Key: `@zoworkhq/forms:{formId}:{formVersionId}`, followed by `:{scopeHash}` whenever the host gave a `scope`, in any mode. A different user or patient in the same tab never receives it.
- Value: `answers`, `idempotencyKey`, and on paged forms `currentPageId`, `visitedPageIds` and `onReview`; `ownerHash` whenever the host gave an `owner`, so `clearDrafts({ owner })` can find it.
- **Session mode** (including a fallback to session, §4: whenever the form keeps no device or server draft):
  - `answers` holds **visible answers only**. Answers to questions hidden by conditions, and hidden repeating groups, stay in the open form's memory, so showing the question again brings its answer back, but they are not written. Whether there is anything worth keeping (§8) is judged on what is written.
  - `startedAt`: when this fill was first written (UTC ISO-8601), kept across saves and restores. A new fill (Clear form, Start over) gets a new one.
  - `address`: the page's address, without its `#fragment`, at the last save.
  - `awaitingChoice: true` while the restore prompt is shown for it (§7).
- **Device and server modes** are unchanged: their copy holds hidden answers too, as the encrypted or server draft does, so a refresh followed by a save never drops them.
- **A form's other versions are swept.** When a form starts keeping progress in the tab (once its own copy has been dealt with, §7.1; never for a later mount of the same form, nor with `mode: 'off'`), it deletes the tab's copies of the same `formId` under any other `formVersionId`, whatever their scope: nothing restores them once the version has changed. A form with a `scope` also deletes the same version's unscoped copy. Copies of the same version under another scope are kept: they belong to another user or subject. A key is this form's only when its `formId` segment is exactly the form's: what follows `{formId}:` must be a `formVersionId` with no `:`, optionally followed by `:{scopeHash}`. So form `intake` never touches the copies of form `intake:child`, and a copy whose `formVersionId` contains `:` is left for the tab to discard when it closes.

## 6. When drafts are saved

| Mode | Saved when |
|---|---|
| `session` | every change (unchanged) |
| `off` | never |
| `device` | every change (debounced, about 1 s), on every page change, and — best effort — when the page is hidden or unloaded |
| `server` | on every page change: **Next, Back, Review, Return to review**. Never on individual answer changes. |

- Saves never block navigation. If one fails, the respondent sees a non-blocking notice (`role="status"`), cleared by the next successful save. Nothing is retried in the background; the notice says when the next save happens:
  - `device`: "Your progress couldn't be saved just now. It will be saved again when you next change an answer."
  - `server`: "Your progress couldn't be saved just now. It will be saved again when you next move to another page."

  Answers are never lost from the open form.
- Saves are sent in order; a later save replaces an earlier one.
- In every mode but `off`, the tab's copy (§5) is kept too, at every change, so a refresh within the tab never depends on the network or the key.

## 7. Restoring

### 7.1 The tab's copy (every mode but `off`)

The tab's copy is read after the form's first render, never during it, so a server-rendered page and its hydration always match. The first render is the empty form; in a browser the choice below is made before anything is painted.

**A scoped copy** (any mode, with a `scope`) restores silently. A refresh in the same tab is not a return, and the scope has already said whose it is.

**An unscoped copy** (session mode, no `scope`) restores silently only when all of these hold:
1. the page's navigation entry (`performance.getEntriesByType('navigation')[0]`) has type `reload`;
2. that entry's own URL (`name`) is the current address;
3. the copy's recorded `address` is the current address;
4. this is the first form the package has mounted in this document, whichever form;
5. the copy isn't marked `awaitingChoice`.

Addresses are compared without their `#fragment`. If the navigation entry can't be read, or the copy has no `address`, the conditions aren't met.

So a refresh of the form's own page restores silently. A link to the form, Back or Forward, a reopened tab, a client-side route change, a later mount in the same document, and a tablet that reloads its home page and then opens the form client-side all get the prompt.

**Otherwise the prompt**, in place of the form, with no answers visible behind it:
- the title "Continue where you left off?" and the buttons **Continue** and **Start over**, as in §7.2;
- the text "This form was started in this browser tab at {time}{ for label} and hasn't been sent." `{time}` follows the respondent's browser locale and includes the date unless that is today. A copy with no readable `startedAt` leaves out " at {time}";
- **Continue** restores answers, page, visited pages, review state and idempotency key, and moves focus to the restored page's title;
- **Start over** deletes the copy and starts a new form with a new idempotency key; focus moves to the start of the form: the first displayed page's title, or the form itself when there is no page to show;
- while the prompt is up the copy is marked `awaitingChoice`, so refreshing the prompt shows it again instead of restoring silently.

**The same form mounted twice at once:** only the first mount reads or writes the copy (and, in device and server modes, looks up and saves the draft). A later mount starts empty and keeps its answers in memory only.

### 7.2 A fresh tab (`device` and `server` modes)

With no tab's copy for this scope, the form looks for a draft for `(scope, formId)`:

| Found | Behaviour |
|---|---|
| Nothing, or expired (device) | start a new form (expired drafts are deleted) |
| Same `formVersionId` | show the prompt: "You have a saved draft from {date, time}{ for label}." — **Continue** or **Start over** |
| Different `formVersionId` | delete the draft (and call `deleteDraft` in server mode), then show the form with: "This form was updated since you saved your draft, so your earlier answers couldn't be kept." |

- The date and time follow the respondent's browser locale.
- **Continue** restores answers, page, visited pages, review state and idempotency key, and moves focus to the restored page's title.
- **Start over** deletes the draft and starts a new form with a new idempotency key; focus moves to the start of the form: the first displayed page's title, or the form itself when there is no page to show.
- The prompt is never skipped in a fresh tab. Focus is not moved when it appears; it is announced through a polite `role="status"` loading region it replaces.
- Server drafts have no package-side expiry; retention is the host's policy.

## 8. Deleting

A draft is deleted on:
- successful submit;
- Clear form;
- Start over;
- a version mismatch (§7);
- in the tab only, a form starting to keep progress: the tab's copies of its other versions, and for a form with a `scope` the same version's unscoped copy (§5). Device and server drafts of another version are deleted when they are looked up (§7.2);
- expiry (device mode);
- nothing left worth keeping: at the next save point, if no question is answered anywhere (hidden answers and nested instances included) and the respondent is still on the first displayed page, the draft and the tab's `sessionStorage` entry are deleted rather than saved empty. Empty starting instances of repeating groups don't count as answers;
- `clearDrafts` from the host, e.g. `clearDrafts({ owner })` on logout. It deletes the matching device drafts and the matching `sessionStorage` entries in the current tab; it does not touch server drafts. In server mode, deleting the server draft on logout is the host's own decision.
  - With no options it removes every tab entry the package wrote in this tab, scoped or not, and the whole device database. `{ scope }` and `{ owner }` remove the matching ones, in session mode too. An unscoped entry has no scope or owner, so only the no-options call removes it.
  - It clears storage, not a form on screen: a form still mounted keeps its answers in memory and writes them again at its next save. Between respondents, call it once the form has unmounted, or remount the form after it.
  - It works without Web Crypto (§5, hashes). Where IndexedDB or `sessionStorage` doesn't exist at all, nothing can have been stored there, so there is nothing to clear.
  - It **rejects** with a `ClearDraftsError` (exported from `@zoworkhq/forms/react`) when it can't delete what it was asked to: a `sessionStorage` call that throws, or an IndexedDB delete that fails or is blocked. The error's `failed` lists which (`"sessionStorage"`, `"indexedDB"`) and its `cause` holds the first underlying error. It never resolves without having cleared.

## 9. Known limits (v1)

- Same device only; no cross-device resume in device mode.
- Two tabs of the same form and scope: the last save wins.
- The package cannot tell whether a device is shared; protection on shared devices depends on the host supplying a correct `scope` and a per-user key.
- Record keys, `scopeHash` and `ownerHash` are unkeyed SHA-256 hashes. They hide ids from casual inspection but can be reversed by guessing when user or patient ids are guessable (e.g. sequential). The answers themselves stay encrypted.
- The tab's `sessionStorage` copy is unencrypted. In session mode it holds visible answers only; in device and server modes it holds hidden answers too. Browsers may write it to disk to restore tabs after a crash or restart.
- A reload of the form's own page looks the same whoever presses it, so an unscoped copy restores silently after one (§7.1). A kiosk that reloads that page between respondents should use `mode: 'off'`, call `clearDrafts()` between them, or give each respondent a `scope`.
- After a reload, two different forms mounted on one page: only the first restores silently; the other shows the prompt.
- On a plain-HTTP page, device mode falls back to session (§4). Scoped tab copies keep working there (§5).
- The best-effort device save on page hide may not finish, because the encrypted write is asynchronous; up to about a second of typing can be missing from the device draft when a tab is closed.