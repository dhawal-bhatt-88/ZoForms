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
  showProgress?: boolean;          // default true
  allowJumpToCompleted?: boolean;  // default false
  reviewPage?: boolean;            // default false
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
7. **Effectively empty:** a group or page with no *displayable* descendant — every descendant is hidden by conditions, or is a `hidden`-type block — is treated as not visible. Its heading and rule are not rendered. In paged mode, such a page is skipped and not counted in progress. This is computed in `/core`, not in `/react`. It has no effect on the payload.

## 3. Condition rules

1. `enableWhen` is allowed on questions, groups and pages.
2. **Ordering rule:** a condition's source must come **before** its dependent in reading order — a depth-first, pre-order walk of the tree (a container is visited before its children).
   - This one rule means a group or page can never depend on its own descendants.
   - It makes cycles impossible, so no separate cycle check is needed.
   - The first page can never have a condition, so at least one page is always visible.
3. Not allowed as a source: `group`, `page`, `matrix`, `divider`, `heading`, `title`, `label`, `hidden`.
4. **Visibility:** an item is visible if and only if its own conditions pass **and** every ancestor is visible.
5. A hidden source makes only **that condition** fail (existing rule, matters for `"any"`).
6. **Hidden answers:** kept in state and sessionStorage, re-shown when visible again, never submitted, never validated (existing rule).

## 4. Numbering

- Continuous 1…n in reading order across the whole tree.
- Only answerable questions are numbered. Groups, pages and presentational blocks are not.
- Numbers are static: hiding does not renumber (gaps are expected).

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
- New public class names: `yf-group`, `yf-group-legend`, `yf-page`, `yf-page-title`, `yf-nav`, `yf-next`, `yf-back`, `yf-progress`, `yf-steps`, `yf-review` (additive under the existing class-name policy).

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
- **Progress** (`showProgress`): "Step x of y" over visible pages only; `y` may change as answers change.
- **Step jumping** (`allowJumpToCompleted`): the step list is clickable for completed pages and the furthest page reached.
- **Review page** (`reviewPage`): lists every visible question on every visible page, grouped by page; unanswered ones show "Not answered"; each page has an Edit link back to it. Submit lives on the review page.