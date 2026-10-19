"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, Callout, Loading, Skeleton } from "@/components/ui";
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
          <Button size="sm" onClick={() => !creating && onClose()} aria-disabled={creating || undefined}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={create}
            pending={creating}
            reason={templateId && !detail && !previewError ? "Waiting for the template to load." : undefined}
          >
            {templateId ? "Use this template" : "Create blank form"}
          </Button>
        </>
      }
    >
      {error && (
        <Callout role="alert" tone="fail" title="Couldn't create the form" className="mb-4">
          {error}
        </Callout>
      )}
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
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[0.8125rem] font-semibold text-ink transition-colors duration-200 ${
                      selected === BLANK ? "border-brand-deep bg-accent-wash" : "border-transparent hover:bg-paper-sunk"
                    }`}
                  >
                    <FilePlus2 aria-hidden="true" className="h-4 w-4 text-graphite-soft" /> Blank form
                  </button>
                </li>
              }
              empty={
                loadError ? (
                  <span className="text-fail">Couldn&apos;t load templates: {loadError}</span>
                ) : !templates ? (
                  <Loading label="Loading templates" className="space-y-2 text-left">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </Loading>
                ) : templates.length ? (
                  <>No form templates match &ldquo;{query}&rdquo;.</>
                ) : (
                  "No form templates yet."
                )
              }
            />
          </div>
        </div>
        <section aria-label="Preview" className="max-h-[60vh] min-h-[240px] overflow-y-auto rounded-xl border border-rule bg-paper p-4">
          {templateId ? (
            <PreviewPane id={templateId} detail={detail} error={previewError} />
          ) : (
            <p className="body-sm py-10 text-center text-graphite">A blank form, ready for your first question.</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
