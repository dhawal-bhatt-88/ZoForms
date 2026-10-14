"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { createForm, createFormFromTemplate, listTemplates, type TemplateSummary } from "@/lib/api";
import { PreviewPane, useTemplateDetail } from "./template-preview";
import { filterTemplates, TemplateChoices, TemplateSearch } from "./template-list";

const BLANK = "__blank__";

/**
 * "New form": start blank, or from a form template — system ones and the
 * organisation's, shown together — with a preview. A form made from a
 * template gets a copy of its content with fresh ids; nothing else carries over.
 * `initial` preselects a template.
 */
export function NewFormDialog({ onClose, initial }: { onClose: () => void; initial?: string }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(initial ?? BLANK);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templateId = selected === BLANK ? null : selected;
  const { detail, error: previewError } = useTemplateDetail(templateId);

  useEffect(() => {
    listTemplates("form")
      .then(setTemplates)
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  const shown = useMemo(() => filterTemplates(templates ?? [], query), [templates, query]);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const form = templateId ? await createFormFromTemplate(templateId) : await createForm("Untitled form");
      router.push(`/app/forms/${form.id}/edit`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  return (
    <Dialog
      title="New form"
      description="Start from a blank form or from a template. A template is copied into the new form."
      onClose={onClose}
      busy={creating}
      width="max-w-4xl"
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-sm text-red">
              Couldn&apos;t create the form: {error}
            </p>
          )}
          <button onClick={onClose} disabled={creating} className="btn btn-outline btn-sm">
            Cancel
          </button>
          <button onClick={create} disabled={creating || (!!templateId && !detail)} className="btn btn-primary btn-sm">
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            {templateId ? "Use this template" : "Create blank form"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <TemplateSearch value={query} onChange={setQuery} label="Search form templates" />
          <div className="max-h-[52vh] overflow-y-auto">
            <TemplateChoices
              templates={loadError || !templates ? [] : shown}
              selected={selected}
              onSelect={setSelected}
              label="How to start"
              extra={
                <li>
                  <button
                    type="button"
                    aria-pressed={selected === BLANK}
                    onClick={() => setSelected(BLANK)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                      selected === BLANK ? "border-accent bg-accent-weak" : "border-transparent hover:bg-surface-2"
                    }`}
                  >
                    <FilePlus2 className="h-4 w-4 text-muted" /> Blank form
                  </button>
                </li>
              }
              empty={
                loadError ? (
                  <span className="text-red">Couldn&apos;t load templates: {loadError}</span>
                ) : !templates ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Loading templates" />
                ) : templates.length ? (
                  <>No form templates match &ldquo;{query}&rdquo;.</>
                ) : (
                  "No form templates yet."
                )
              }
            />
          </div>
        </div>
        <section aria-label="Preview" className="max-h-[60vh] min-h-[240px] overflow-y-auto rounded-xl border border-line bg-bg p-4">
          {templateId ? (
            <PreviewPane id={templateId} detail={detail} error={previewError} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">A blank form, ready for your first question.</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
