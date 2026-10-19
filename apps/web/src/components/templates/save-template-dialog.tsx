"use client";

import { useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
  const nameId = useId();
  const descriptionId = useId();

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
          <button onClick={onClose} disabled={saving} className="btn btn-outline btn-sm">
            Cancel
          </button>
          <button onClick={save} disabled={saving || !name.trim() || !!plan.problem} className="btn btn-primary btn-sm">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {changes ? "Save without them" : "Save template"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor={nameId} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
          Template name
        </label>
        <input
          id={nameId}
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          required
          className="input mb-3 w-full"
        />
        <label htmlFor={descriptionId} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={descriptionId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={2}
          className="input w-full resize-none"
        />
      </form>

      {changes && (
        <section aria-labelledby={`${nameId}-changes`} className="mt-4 rounded-xl border border-warn/30 bg-warn-wash px-3.5 py-3">
          <h3 id={`${nameId}-changes`} className="text-sm font-semibold text-ink">
            Some conditions won&apos;t be included
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-2">A template can only use questions inside it.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-2" data-removed-conditions>
            {plan.removed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {plan.rewritten.length > 0 && (
            <>
              <p className="mt-2.5 text-[13px] font-semibold text-ink">Logic that changes</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-ink-2" data-rewritten-logic>
                {plan.rewritten.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {plan.problem && (
        <p role="alert" className="mt-4 rounded-lg bg-fail-wash px-3 py-2 text-sm text-red">
          This can&apos;t be saved as a template yet: {plan.problem}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-fail-wash px-3 py-2 text-sm text-red">
          Couldn&apos;t save the template: {error}
        </p>
      )}
    </Dialog>
  );
}
