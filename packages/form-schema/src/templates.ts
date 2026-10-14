/*
 * Templates — builder only. A form template is a whole form's content; a group
 * template is one group block, with the groups and repeating groups inside it.
 *
 * Inserting a template copies it: every block gets a fresh id and the copy's
 * conditions follow, so the same template can go into one form twice. Nothing
 * links the copy to the template afterwards except its `templateRef`, which is
 * provenance only and never leaves the builder (see `TemplateRef`). So none of
 * this is in the contract: the renderer only ever sees ordinary content.
 *
 * A template must be self-contained: every condition in it, at any depth and
 * including the root group's own, uses a question inside it.
 */
import { z } from "zod";
import {
  describeBlockPath,
  draftsProblem,
  DEFAULT_PAGE_TITLE,
  formProblems,
  isContainer,
  isGroup,
  isPaged,
  newBlockId,
  newPage,
  walkBlocks,
  withoutTemplateRefs,
  type Block,
  type Condition,
  type FormSchema,
  type FormSettings,
  type GroupBlock,
  type PageBlock,
  type TemplateRef,
} from "./index";
import { logicTreeToText, logicWithout, parseLogicText } from "./logic";

export const TemplateKind = z.enum(["form", "group"]);
export type TemplateKind = z.infer<typeof TemplateKind>;

/** The title of the stand-in form a group template is checked and edited as. */
export const GROUP_TEMPLATE_TITLE = "Group template";

/** Why "Insert as page" is unavailable in a form without pages that has content. */
export const INSERT_AS_PAGE_UNAVAILABLE = "This form has no pages. Add a page first or insert as a group.";

/**
 * A template's content as a form: a form template's as it is, and a group
 * template's as the only block of a form without pages — the shape it is
 * checked, compared and edited in. Works on raw input too, before parsing.
 */
export function templateAsForm(kind: TemplateKind, content: unknown): unknown {
  return kind === "form" ? content : { title: GROUP_TEMPLATE_TITLE, blocks: [content] };
}

/** Back from `templateAsForm`: the form, or its one group. Check `templateProblems` first. */
export function templateFromForm(kind: TemplateKind, form: FormSchema): FormSchema | GroupBlock {
  return kind === "form" ? form : (form.blocks[0] as GroupBlock);
}

/*
 * Form settings a template never keeps. They route a form's answers somewhere
 * (`notifyEmails`, `redirectUrl`) or identify the organisation it was made for
 * (the theme's `logo` and `cover` images). Presentation and behaviour settings
 * stay. Automations, integrations, custom domains and the form's slug aren't
 * part of form content at all, so a template can't carry them.
 */
export const TEMPLATE_STRIPPED_SETTINGS = ["notifyEmails", "redirectUrl"] as const;
export const TEMPLATE_STRIPPED_THEME_SETTINGS = ["logo", "cover"] as const;

function templateSettings(settings: FormSettings | undefined): FormSettings | undefined {
  if (!settings) return undefined;
  const kept: Record<string, unknown> = { ...settings };
  for (const key of TEMPLATE_STRIPPED_SETTINGS) delete kept[key];
  if (settings.theme) {
    const theme: Record<string, unknown> = { ...settings.theme };
    for (const key of TEMPLATE_STRIPPED_THEME_SETTINGS) delete theme[key];
    if (Object.keys(theme).length) kept.theme = theme;
    else delete kept.theme;
  }
  return Object.keys(kept).length ? (kept as FormSettings) : undefined;
}

/**
 * A template's content as stored: without template references at any depth
 * (a template doesn't carry another template's provenance) and without the
 * settings in `TEMPLATE_STRIPPED_SETTINGS` and `TEMPLATE_STRIPPED_THEME_SETTINGS`.
 */
export function cleanTemplateForm(form: FormSchema): FormSchema {
  const { templateRef: _ref, settings, ...rest } = form;
  const kept = templateSettings(settings);
  return { ...rest, ...(kept ? { settings: kept } : {}), blocks: withoutTemplateRefs(form.blocks) };
}

/** A condition that uses a question outside the blocks it was found in. */
export type OutsideCondition = {
  /** The block the condition is on. */
  block: Block;
  /** That block named as the save rules name it, within these blocks. */
  subject: string;
  /** The condition's number on its block, from 1 (contract §15). */
  number: number;
  condition: Condition;
};

/**
 * Every condition in `blocks`, at any depth and on the containers themselves,
 * whose question isn't among `blocks` — what makes them not self-contained.
 */
export function outsideConditions(blocks: readonly Block[]): OutsideCondition[] {
  const entries = walkBlocks(blocks);
  const inside = new Set(entries.map((entry) => entry.block.id));
  return entries.flatMap((entry) =>
    (entry.block.enableWhen ?? []).flatMap((condition, i) =>
      inside.has(condition.question)
        ? []
        : [{
            block: entry.block,
            subject: describeBlockPath([...entry.ancestors, entry.block], entry.path),
            number: i + 1,
            condition,
          }],
    ),
  );
}

/** A block whose logic text changed because some of its conditions were removed. */
export type RewrittenLogic = {
  block: Block;
  before: string;
  /** The text made from the conditions left, or null when fewer than 2 are left and it goes. */
  after: string | null;
};

/**
 * `group` without the conditions that use questions outside it — for saving a
 * group from a form as a template; the form itself is never changed. The root
 * group's own conditions always go: a group can't depend on its own contents.
 * An item that loses conditions gets logic text made from what is left, with
 * the parts that used them taken out (`logicWithout`). Expects the group to
 * pass the save rules, so its logic text parses; text that doesn't is dropped,
 * which leaves the remaining conditions combined with AND.
 */
export function withoutOutsideConditions(group: GroupBlock): {
  group: GroupBlock;
  removed: OutsideCondition[];
  rewritten: RewrittenLogic[];
} {
  const removed = outsideConditions([group]);
  const rewritten: RewrittenLogic[] = [];
  const byBlock = new Map<string, Set<number>>();
  for (const r of removed) byBlock.set(r.block.id, (byBlock.get(r.block.id) ?? new Set()).add(r.number));

  const strip = (block: Block): Block => {
    const gone = byBlock.get(block.id);
    let own = block;
    if (gone) {
      const conditions = block.enableWhen ?? [];
      const kept = conditions.filter((_, i) => !gone.has(i + 1));
      const { enableWhen: _w, enableLogicText, enableBehavior: _b, enableLogic: _l, ...rest } = block;
      let text: string | null = null;
      if (enableLogicText !== undefined && conditions.length >= 2) {
        const parsed = parseLogicText(enableLogicText, conditions.length);
        const tree = parsed.ok ? logicWithout(parsed.tree, gone) : null;
        text = kept.length >= 2 && tree !== null ? logicTreeToText(tree) : null;
        if (text !== enableLogicText) rewritten.push({ block, before: enableLogicText, after: text });
      }
      own = {
        ...rest,
        ...(kept.length ? { enableWhen: kept } : {}),
        ...(text !== null ? { enableLogicText: text } : {}),
      } as Block;
    }
    return isContainer(own) ? ({ ...own, blocks: own.blocks.map(strip) } as Block) : own;
  };

  return { group: strip(group) as GroupBlock, removed, rewritten };
}

/**
 * Every reason a template's content can't be saved, in the API's words. Pass
 * the content as a form (`templateAsForm`), parsed, with its conditions
 * normalized (`normalizeConditions`). In order:
 *  - a group template is exactly one group;
 *  - every condition uses a question inside the template;
 *  - every save rule a form has: integrity, codes, logic text, grid,
 *    conditions (`formProblems`) and drafts (`draftsProblem`).
 * Empty means it can be saved.
 */
export function templateProblems(kind: TemplateKind, form: FormSchema): string[] {
  if (kind === "group" && (form.blocks.length !== 1 || !isGroup(form.blocks[0]))) {
    return ["A group template holds exactly one group, and nothing else."];
  }
  const outside = outsideConditions(form.blocks).map(
    (o) =>
      `${o.subject}: condition ${o.number} refers to a question outside this template (id "${o.condition.question}"). A template's conditions can only use questions inside it.`,
  );
  if (outside.length) return outside;
  const problems = formProblems(form).map((p) => p.message);
  const drafts = draftsProblem(form);
  return drafts ? [...problems, drafts] : problems;
}

/**
 * `blocks` with every block given a fresh id (`newBlockId`), none in `taken`,
 * and every condition that uses one of them following it — at any depth, on
 * pages, groups and repeating groups as well as questions. Everything else is
 * kept as it is: condition ids (unique only within their item, contract §15.1),
 * logic text (it uses condition numbers), option codes and labels. A condition
 * on a question outside `blocks` is left alone. `ids` maps old ids to new.
 */
export function remapBlockIds(
  blocks: readonly Block[],
  taken: Iterable<string> = [],
): { blocks: Block[]; ids: Map<string, string> } {
  const used = new Set(taken);
  const ids = new Map<string, string>();
  for (const { block } of walkBlocks(blocks)) {
    const id = newBlockId(used);
    used.add(id);
    ids.set(block.id, id);
  }
  const copy = (block: Block): Block => {
    const next = { ...block, id: ids.get(block.id)! } as Block;
    if (block.enableWhen) {
      next.enableWhen = block.enableWhen.map((c) => {
        const question = ids.get(c.question);
        return question === undefined ? c : { ...c, question };
      });
    }
    return isContainer(next) ? ({ ...next, blocks: next.blocks.map(copy) } as Block) : next;
  };
  return { blocks: blocks.map(copy), ids };
}

/** A template as it is inserted: its identity, its current version, its name and its content. */
export type TemplateSource<C> = { id: string; version: number; name: string; content: C };

function refOf(template: TemplateSource<unknown>): TemplateRef {
  return { id: template.id, version: template.version, name: template.name };
}

/**
 * A group template's copy, ready to insert into a form whose ids are `taken`:
 * fresh ids throughout and `templateRef` on the group.
 */
export function groupFromTemplate(template: TemplateSource<GroupBlock>, taken: Iterable<string>): GroupBlock {
  const [group] = remapBlockIds(withoutTemplateRefs([template.content]), taken).blocks as GroupBlock[];
  return { ...group, templateRef: refOf(template) };
}

/**
 * "Insert as page" for `group` (from `groupFromTemplate`): a new page, titled
 * with the group's label, holding the group. Pass every id in the form as
 * `taken`; the group's own are added.
 */
export function pageForTemplateGroup(group: GroupBlock, taken: Iterable<string>): PageBlock {
  const ids = [...taken, ...walkBlocks([group]).map((entry) => entry.block.id)];
  return { ...newPage(ids, group.label.trim() || DEFAULT_PAGE_TITLE), blocks: [group] };
}

/** Whether a group template can go in as a page: only in a form with pages, or an empty one. */
export function canInsertAsPage(blocks: readonly Block[]): boolean {
  return blocks.length === 0 || isPaged(blocks);
}

/** A new form's content from a form template: fresh block ids throughout, and `templateRef` on the form. */
export function formFromTemplate(template: TemplateSource<FormSchema>): FormSchema {
  const { templateRef: _ref, ...content } = template.content;
  return {
    ...content,
    blocks: remapBlockIds(withoutTemplateRefs(content.blocks)).blocks,
    templateRef: refOf(template),
  };
}
