"use client";

import { useId, useMemo, useState } from "react";
import {
  blockName,
  cleanTemplateForm,
  findBlock,
  FormSchema,
  normalizeConditions,
  normalizeScores,
  templateAsForm,
  templateProblems,
  withoutOutsideConditions,
  type Condition,
  type GroupBlock,
} from "@formbuilder/form-schema";
import { Dialog } from "@/components/dialog";
import { Button, Callout, Field, Input, Textarea } from "@/components/ui";
import { createTemplate, type TemplateSummary } from "@/lib/api";

/**
 * Save a group, or the whole form, as one of the organisation's templates,
 * from what is in the editor now. The form itself is never changed.
 *
 * A group's conditions that use questions outside it can't come with it:
 * they're listed here before anything is saved, with any logic text that is
 * rewritten from the conditions left, and the copy is saved without them. A
 * copy that still breaks a save rule says so and can't be saved.
 */
export function SaveTemplateDialog({
  kind,
  form,
  groupId,
  phrase,
  onSaved,
  onClose,
}: {
  kind: "form" | "group";
  /** The editor's current content. */
  form: FormSchema;
  /** For a group: which one. */
  groupId?: string;
  /** A condition in words, e.g. `"Do you smoke?" is Yes`. */
  phrase: (condition: Condition) => string;
  onSaved: (template: TemplateSummary) => void;
  onClose: () => void;
}) {
  const changesId = useId();

  const plan = useMemo(() => {
    const group = kind === "group" ? (findBlock(form.blocks, groupId ?? "")?.block as GroupBlock | undefined) : undefined;
    const stripped = group ? withoutOutsideConditions(group) : undefined;
    const content = stripped ? stripped.group : form;
    const parsed = FormSchema.safeParse(templateAsForm(kind, content));
    const problems = parsed.success
      ? templateProblems(kind, cleanTemplateForm({ ...parsed.data, blocks: normalizeScores(normalizeConditions(parsed.data.blocks)) }))
      : [`${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}`];
    return {
      content,
      defaultName: group ? group.label.trim() : form.title.trim(),
      removed: (stripped?.removed ?? []).map(
        (r) =>
          `"${blockName(r.block)}" — condition ${r.number} (${phrase(r.condition)}) refers to a question outside this group and won't be included.`,
      ),
      rewritten: (stripped?.rewritten ?? []).map((r) =>
        r.after === null
          ? `"${blockName(r.block)}" — its logic "${r.before}" is dropped: only one condition is left.`
          : `"${blockName(r.block)}" — its logic "${r.before}" becomes "${r.after}".`,
      ),
      problem: problems[0] ?? null,
    };
  }, [kind, form, groupId, phrase]);

  const [name, setName] = useState(plan.defaultName);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = plan.removed.length > 0;

  async function save() {
    if (!name.trim() || plan.problem || saving) return;
    setSaving(true);
    setError(null);
    try {
      const t = await createTemplate({
        kind,
        name: name.trim(),
        description: description.trim() || undefined,
        content: plan.content as FormSchema | GroupBlock,
      });
      onSaved(t);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog
      title={kind === "group" ? "Save group as template" : "Save form as template"}
      description={
        kind === "group"
          ? "A copy of this group is saved to your organisation's templates. This form doesn't change."
          : "A copy of this form is saved to your organisation's templates. This form doesn't change."
      }
      onClose={onClose}
      busy={saving}
      width="max-w-lg"
      footer={
        <>
          <Button size="sm" onClick={() => !saving && onClose()} aria-disabled={saving || undefined}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            pending={saving}
            reason={plan.problem ? "This can't be saved as a template yet." : !name.trim() ? "A template needs a name." : undefined}
          >
            {changes ? "Save without them" : "Save template"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Template name" required>
          {(field) => <Input {...field} data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Description">
          {(field) => (
            <Textarea {...field} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} />
          )}
        </Field>
      </form>

      {changes && (
        <section aria-labelledby={changesId} className="mt-4 rounded-r-xl border border-l-[3px] border-warn/25 border-l-warn bg-warn-wash px-4 py-3">
          <h3 id={changesId} className="text-[0.8125rem] font-semibold text-warn">
            Some conditions won&apos;t be included
          </h3>
          <p className="body-sm mt-0.5 text-graphite">A template can only use questions inside it.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.8125rem] text-ink" data-removed-conditions>
            {plan.removed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {plan.rewritten.length > 0 && (
            <>
              <p className="mt-2.5 text-[0.8125rem] font-semibold text-ink">Logic that changes</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.8125rem] text-ink" data-rewritten-logic>
                {plan.rewritten.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {plan.problem && (
        <Callout role="alert" tone="fail" title="This can't be saved as a template yet" className="mt-4">
          {plan.problem}
        </Callout>
      )}
      {error && (
        <Callout role="alert" tone="fail" title="Couldn't save the template" className="mt-4">
          {error}
        </Callout>
      )}
    </Dialog>
  );
}
