import path from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { SOURCE_OPERATORS, type ConditionOperator } from "@formbuilder/form-schema";
import { OPERATOR_TEXT } from "../../components/form-editor/operator-text";
import { CONTENT_DIR, readJson } from "./content";
import { attributesOf, type MdNode } from "./mdast";

/*
 * The "For developers" section of every question page (developer docs brief,
 * scope item 3), from one data file: content/docs/build/question-types/
 * question-values.json. A page writes `<ForDevelopers type="dropdown" />`
 * under its heading, and the section is built here, as Markdown, for the web
 * page and its `.md` alike. The condition operators come from the builder's
 * own table, SOURCE_OPERATORS, with the editor's words for them.
 * question-values.test.ts runs every value, condition, score and validator
 * through the real package.
 */

export type ScoreKind = "answer" | "option" | "options" | "columns";

export type QuestionValue = {
  /** The question page, in build/question-types. */
  page: string;
  /** Mid-sentence, with its article: "a dropdown". */
  name: string;
  /** The question's id in the page's example form. */
  field: string;
  /** "the chosen option's code". */
  sends: string;
  /** "With nothing chosen". */
  unanswered: string;
  /** An answer's value as the browser sends it. */
  example: unknown;
  /** The same answer's value as prepareSubmission stores it. */
  stored: unknown;
  storedNote?: string;
  /** What a condition's `answer` is, or null when the type can't be a condition's source. */
  conditionAnswer: string | null;
  scoring: ScoreKind | null;
  validator: { intro: string; code: string; fails: unknown; message: string; passes: unknown } | null;
};

// A function, not a constant: content.ts imports this file, so CONTENT_DIR isn't set yet when it loads.
export const questionValuesFile = () => path.join(CONTENT_DIR, "build", "question-types", "question-values.json");

/** Every question type with a page, by type. Keys starting with `$` are notes, not types. */
export function questionValues(): Record<string, QuestionValue> {
  const all = readJson(questionValuesFile()) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(all).filter(([key]) => !key.startsWith("$"))) as Record<string, QuestionValue>;
}

/** Answerable types the builder no longer offers, which have no page on purpose: type → why. */
export function notOffered(): Record<string, string> {
  return ((readJson(questionValuesFile()) as Record<string, unknown>).$notOffered ?? {}) as Record<string, string>;
}

/** The operators the builder offers for a type, in its order: none for a type that can't be a source. */
export const operatorsFor = (type: string): readonly ConditionOperator[] => SOURCE_OPERATORS[type as keyof typeof SOURCE_OPERATORS] ?? [];

/** JSON on one line, as `{ "a": 1 }`. */
function inlineJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(", ")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${inlineJson(v)}`);
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  }
  return JSON.stringify(value);
}

/** JSON that breaks a value over lines only when it doesn't fit on one, `at` characters in. */
function fittedJson(value: unknown, indent = "", at = 0): string {
  const line = inlineJson(value);
  if (!value || typeof value !== "object" || at + line.length <= 88) return line;
  const inner = `${indent}  `;
  const items = Array.isArray(value)
    ? value.map((v) => inner + fittedJson(v, inner, inner.length))
    : Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${fittedJson(v, inner, inner.length + k.length + 4)}`);
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  return `${open}\n${items.join(",\n")}\n${indent}${close}`;
}

/** One answer as a block shows it. */
const answerJson = (field: string, value: unknown) => fittedJson({ [field]: { state: "answered", value } });

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "a dropdown" → "the dropdown". */
const definite = (name: string) => name.replace(/^an? /, "the ");

/** "a, b and c". */
const listed = (items: readonly string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

const SCORING: Record<ScoreKind, (name: string) => string> = {
  answer: () => "Inside a group with a score, the group's formula can use it: it counts as the number answered.",
  option: (name) =>
    `Inside a group with a score, give each option a Score. In the group's formula, ${name} counts as the chosen option's score. Every option needs one.`,
  options: (name) =>
    `Inside a group with a score, give each option a Score. In the group's formula, ${name} counts as the sum of the ticked options' scores. Every option needs one.`,
  columns: () =>
    'Inside a group with a score, give each column a Score. In the group\'s formula, the matrix counts as the sum of each answered row\'s column score. Every column needs one. With a row unanswered, the matrix counts as unanswered under "No score", and that row as 0 under "Count as 0".',
};

/** The section's Markdown, below its heading. */
export function forDevelopersMarkdown(type: string, entry: QuestionValue): string {
  const name = entry.name;
  const out: string[] = [];

  out.push(`**Payload.** The browser sends ${entry.sends}:`);
  out.push("```json\n" + answerJson(entry.field, entry.example) + "\n```");
  out.push(`${entry.unanswered}, it sends \`{ "state": "empty" }\`. ${capital(name)} hidden by its conditions isn't in the payload at all.`);

  const same = JSON.stringify(entry.example) === JSON.stringify(entry.stored);
  out.push(
    same
      ? "**`prepareSubmission`.** On your server the answer is stored as it was sent:"
      : "**`prepareSubmission`.** On your server the answer comes back with labels, looked up from the form file you pass, never from the request:",
  );
  out.push("```json\n" + answerJson(entry.field, entry.stored) + "\n```");
  if (entry.storedNote) out.push(entry.storedNote);

  const operators = operatorsFor(type);
  out.push(
    operators.length && entry.conditionAnswer
      ? `**Conditions.** As the source of a condition, ${name} offers ${listed(operators.map((o) => OPERATOR_TEXT[o]))}, which the form file stores as ${listed(operators.map((o) => `\`${o}\``))}. ${entry.conditionAnswer} See [Show a question only when it applies](/docs/build/show-questions-conditionally).`
      : `**Conditions.** ${capital(name)} can't be the source of a condition. The builder doesn't offer it, and the package refuses a form file that has one.`,
  );

  out.push(
    `**Scoring.** ${entry.scoring ? SCORING[entry.scoring](definite(name)) :"It can't be used in a score: the package refuses a form file whose formula uses it."} See [Read scores](/docs/integrate/scores).`,
  );

  const validators = "**Validators.** A validator gets the answer as `value`, in the same form as the payload above, once it passes the built-in checks.";
  if (entry.validator) {
    out.push(`${validators} ${entry.validator.intro}`);
    out.push("```js file=validators.js\n" + entry.validator.code.replace(/\n$/, "") + "\n```");
    out.push("Pass the same `validators` to `FormRenderer` and to `prepareSubmission`. See [Add your own validation](/docs/integrate/custom-validation).");
  } else {
    out.push(`${validators} See [Add your own validation](/docs/integrate/custom-validation).`);
  }
  return out.join("\n\n") + "\n";
}

/** The section as Markdown nodes. Plain Markdown, so a `{` in it is text. */
export function forDevelopersNodes(type: string, entries = questionValues()): MdNode[] {
  const entry = entries[type];
  if (!entry) throw new Error(`<ForDevelopers type="${type}">: there's no "${type}" in question-values.json`);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(forDevelopersMarkdown(type, entry)) as unknown as MdNode;
  return tree.children ?? [];
}

const isForDevelopers = (node: MdNode) => node.type === "mdxJsxFlowElement" && node.name === "ForDevelopers";

/** Every `<ForDevelopers type="…" />` in a tree, replaced by its section. Changes the tree in place, and returns it. */
export function expandForDevelopers(tree: MdNode): MdNode {
  let entries: Record<string, QuestionValue> | undefined;
  const visit = (node: MdNode) => {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      if (!isForDevelopers(child)) {
        visit(child);
        return [child];
      }
      entries ??= questionValues();
      return forDevelopersNodes(attributesOf(child).type ?? "", entries);
    });
  };
  visit(tree);
  return tree;
}

/** The remark plugin that does the same on the rendered page, before the code titles are read. */
export function remarkForDevelopers() {
  return (tree: MdNode) => {
    expandForDevelopers(tree);
  };
}
