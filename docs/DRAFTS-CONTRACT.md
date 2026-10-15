# Drafts — Contract

Status: agreed 29 Sep 2026; amended 29 Sep 2026 after renderer Checkpoint 0; amended 5 Oct 2026 for repeating groups (§5, §8). Shared by the builder repo and the `@zoworkhq/forms` renderer repo.
Change it here first, then in both repos.

## 1. Purpose

Let a respondent close the browser part-way through a long form and continue later **on the same device**, without the form package ever holding PHI itself and without knowing how the host app authenticates users.

## 2. Modes (author's choice, stored in the schema)

```ts
drafts?: { mode: "session" | "device" | "server" }   // default "session"
```

| Mode | Where the draft lives | Survives a closed tab | Host must provide |
|---|---|---|---|
| `session` | `sessionStorage` (today's behaviour, unchanged) | No | nothing |
| `device` | IndexedDB, encrypted | Yes, same device | `scope` + `getKey` |
| `server` | the host's own backend | Yes | `scope` + `loadDraft` / `saveDraft` / `deleteDraft` |

- `server` is only offered for **paged forms** (it saves on page changes). The builder enforces this; if pages are later removed, the setting reverts to `session` with a note to the author.
- The exported artifact carries `drafts` only when the mode is not `session`.

## 3. Host API (renderer)

```ts
<FormRenderer
  drafts={{
    scope: string,                                  // opaque; see 3.1
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
//   no options -> every draft on this device
//   { scope, owner } together, or a non-object argument -> throws TypeError (ambiguous, and a mistake here deletes drafts)
```

### 3.1 `scope`
- Opaque to the package; never interpreted.
- Must identify **the user**, and **the subject** (patient, visit, episode) whenever the same form is filled for more than one subject. Example: `` `${userId}:${patientId}` ``. Getting this wrong can restore one patient's answers into another patient's form.
- `owner` is also opaque and should identify only **the user** (e.g. `userId`). It lets the host clear all of one user's drafts at logout without knowing which subjects they have drafts for. Recommended wherever a device may be shared.

### 3.2 Key (device mode)
- Supplied by the host after the user logs in, e.g. from a per-user key the host's server holds or derives. The package never generates, stores or exports it.
- A key that fails to decrypt a draft (e.g. rotated) is treated as "no usable draft": the draft is deleted and the respondent sees: "Your saved draft couldn't be opened, so you're starting a new form."

## 4. Problems and fallbacks — never block the form

Draft problems are reported through `onDraftProblem`, never `onError`.

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
| IndexedDB or Web Crypto unavailable | fall back to `session`; same |
| `loadDraft` fails on mount | fall back to `session` for that mount, so an existing server draft is never overwritten; report `draft-load-failed`; show the notice "Your progress can't be saved for later on this visit." |
| `getKey` fails (device mode) | same as `loadDraft` failing: fall back to `session` for that mount, leave the device draft untouched, report `draft-load-failed`, show the same notice |
| A save fails (either mode) | report `draft-save-failed`; show the non-blocking notice (§6); retry on the next save point |
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
- IndexedDB database `yourco-forms-drafts`, one record per `(scope, formId)`.
- Record key: hex SHA-256 of `scope` + a separator character that can't appear in the hash input ambiguously (e.g. U+0000) + `formId`.
- Record value: `{ scopeHash, ownerHash?, iv, ciphertext, expiresAt }`, with indexes on `scopeHash` and `ownerHash` (each a hex SHA-256 of `scope` / `owner`), so `clearDrafts` can find every matching draft across forms. `ownerHash` is present only when the host supplied `owner`.
- `ciphertext` is the AES-GCM encryption of the whole `Draft` with a fresh 96-bit IV per save. `expiresAt` stays in clear so expired records can be swept without a key.
- Device mode also keeps the tab's `sessionStorage` entry, exactly as session mode does, so a refresh restores from it (§7). In `device` and `server` modes that entry's key includes `scopeHash`, so a different user or patient in the same tab never receives it; the entry also records `ownerHash` when `owner` is supplied, so `clearDrafts({ owner })` can find it.

## 6. When drafts are saved

| Mode | Saved when |
|---|---|
| `session` | every change (unchanged) |
| `device` | every change (debounced, about 1 s), on every page change, and — best effort — when the page is hidden or unloaded |
| `server` | on every page change: **Next, Back, Review, Return to review**. Never on individual answer changes. |

- Saves never block navigation. If one fails, the respondent sees a non-blocking notice ("Your progress couldn't be saved — it will be tried again.", `role="status"`), cleared by the next successful save. Answers are never lost from the open form.
- Saves are sent in order; a later save replaces an earlier one.
- In every mode, `sessionStorage` is kept as today, so a refresh within the tab never depends on the network or the key.

## 7. Restoring (`device` and `server` modes only)

`session` mode is unchanged: a refresh restores silently, as today.

**A refresh in the same tab is not a return.** In every mode, if the tab's `sessionStorage` entry exists (for this scope, in device and server modes), it restores silently, without the prompt.

**A fresh tab** looks for a draft for `(scope, formId)`:

| Found | Behaviour |
|---|---|
| Nothing, or expired (device) | start a new form (expired drafts are deleted) |
| Same `formVersionId` | show the prompt: "You have a saved draft from {date, time}{ for label}." — **Continue** or **Start over** |
| Different `formVersionId` | delete the draft (and call `deleteDraft` in server mode), then show the form with: "This form was updated since you saved your draft, so your earlier answers couldn't be kept." |

- The date and time follow the respondent's browser locale.
- **Continue** restores answers, page, visited pages, review state and idempotency key, and moves focus to the restored page's title.
- **Start over** deletes the draft and starts a new form with a new idempotency key; focus is not moved.
- The prompt is never skipped in a fresh tab. Focus is not moved when it appears; it is announced through a polite `role="status"` loading region it replaces.
- Server drafts have no package-side expiry; retention is the host's policy.

## 8. Deleting

A draft is deleted on:
- successful submit;
- Clear form;
- Start over;
- a version mismatch (§7);
- expiry (device mode);
- nothing left worth keeping: at the next save point, if no question is answered anywhere (hidden answers and nested instances included) and the respondent is still on the first displayed page, the draft and the tab's `sessionStorage` entry are deleted rather than saved empty. Empty starting instances of repeating groups don't count as answers;
- `clearDrafts` from the host, e.g. `clearDrafts({ owner })` on logout. It deletes the matching device drafts and the matching `sessionStorage` entries in the current tab; it does not touch server drafts. In server mode, deleting the server draft on logout is the host's own decision.

## 9. Known limits (v1)

- Same device only; no cross-device resume in device mode.
- Two tabs of the same form and scope: the last save wins.
- The package cannot tell whether a device is shared; protection on shared devices depends on the host supplying a correct `scope` and a per-user key.
- Record keys, `scopeHash` and `ownerHash` are unkeyed SHA-256 hashes. They hide ids from casual inspection but can be reversed by guessing when user or patient ids are guessable (e.g. sequential). The answers themselves stay encrypted.
- The tab's `sessionStorage` copy is unencrypted, as in session mode today. Browsers may write it to disk to restore tabs after a crash or restart.
- The best-effort device save on page hide may not finish, because the encrypted write is asynchronous; up to about a second of typing can be missing from the device draft when a tab is closed.