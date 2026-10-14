import { BadRequestException } from "@nestjs/common";
import {
  cleanTemplateForm,
  FormSchema,
  idsFromPrevious,
  normalizeConditions,
  sameContent,
  templateAsForm,
  templateFromForm,
  templateProblems,
  type GroupBlock,
  type TemplateKind,
} from "@formbuilder/form-schema";
import { describeSchemaError } from "../common/schema-errors";

/**
 * A template's content as it is stored, or a 400 saying why it can't be. The
 * same steps as saving a form — parse, condition ids and logic text
 * (`normalizeConditions`), every save rule — with a group template checked as
 * the only group of a form without pages, plus the template rules
 * (`templateProblems`): self-contained, and for a group template exactly one
 * group. Template references and the settings a template never keeps are
 * dropped (`cleanTemplateForm`). `previous` is the stored content being
 * replaced: a condition re-sent without its id keeps the one it has.
 */
export function prepareTemplateContent(kind: TemplateKind, raw: unknown, previous?: unknown): FormSchema | GroupBlock {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new BadRequestException(
      kind === "form"
        ? "content is required: a form template's content is a form schema."
        : "content is required: a group template's content is one group block.",
    );
  }
  const asForm = templateAsForm(kind, raw);
  const parsed = FormSchema.safeParse(asForm);
  if (!parsed.success) throw new BadRequestException(describeSchemaError(asForm, parsed.error));
  const before = previous === undefined ? undefined : FormSchema.safeParse(templateAsForm(kind, previous));
  const form = cleanTemplateForm({
    ...parsed.data,
    blocks: normalizeConditions(parsed.data.blocks, idsFromPrevious(before?.success ? before.data.blocks : [])),
  });
  const problems = templateProblems(kind, form);
  if (problems.length) {
    const more = problems.length > 1 ? ` (+${problems.length - 1} more)` : "";
    throw new BadRequestException(problems[0] + more);
  }
  return templateFromForm(kind, form);
}

/** True when two stored contents of a `kind` template are the same content (see `sameContent`). */
export function sameTemplateContent(kind: TemplateKind, a: unknown, b: unknown): boolean {
  return sameContent(templateAsForm(kind, a), templateAsForm(kind, b));
}
