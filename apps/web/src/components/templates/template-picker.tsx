"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { listTemplates, type TemplateDetail, type TemplateSummary } from "@/lib/api";
import { PreviewPane, useTemplateDetail } from "./template-preview";
import { filterTemplates, TemplateChoices, TemplateSearch } from "./template-list";

/**
 * "From template…": choose a group template — system ones and the
 * organisation's — preview it, and insert it as a group, or as a new page.
 * "Insert as page" is offered only when `asPage` is null; otherwise it is
 * disabled, with `asPage` as the reason shown under it.
 */
export function TemplatePicker({
  asPage,
  onInsert,
  onClose,
}: {
  /** Why "Insert as page" isn't available here, or null when it is. */
  asPage: string | null;
  onInsert: (template: TemplateDetail, as: "group" | "page") => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { detail, error } = useTemplateDetail(selected);
  const reasonId = useId();

  useEffect(() => {
    listTemplates("group")
      .then((list) => {
        setTemplates(list);
        setSelected((s) => s ?? list[0]?.id ?? null);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  const shown = useMemo(() => filterTemplates(templates ?? [], query), [templates, query]);

  return (
    <Dialog
      title="Insert from a template"
      description="A group template is copied into this form. Later changes to the template don't change the copy."
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          {asPage && (
            <p id={reasonId} className="mr-auto text-[13px] text-muted">
              {asPage}
            </p>
          )}
          <button onClick={onClose} className="btn btn-outline btn-sm">
            Cancel
          </button>
          <button
            onClick={() => detail && onInsert(detail, "page")}
            disabled={!detail || !!asPage}
            aria-describedby={asPage ? reasonId : undefined}
            className="btn btn-outline btn-sm"
          >
            Insert as page
          </button>
          <button onClick={() => detail && onInsert(detail, "group")} disabled={!detail} className="btn btn-primary btn-sm">
            Insert as group
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <TemplateSearch value={query} onChange={setQuery} label="Search group templates" />
          {loadError ? (
            <p className="rounded-lg bg-[#FCECEC] px-3 py-2 text-sm text-red">Couldn&apos;t load templates: {loadError}</p>
          ) : !templates ? (
            <div className="grid place-items-center py-8 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading templates" />
            </div>
          ) : (
            <div className="max-h-[52vh] overflow-y-auto">
              <TemplateChoices
                templates={shown}
                selected={selected}
                onSelect={setSelected}
                label="Group templates"
                empty={
                  templates.length
                    ? <>No group templates match &ldquo;{query}&rdquo;.</>
                    : "No group templates yet. Save a group as a template from its ⋯ menu on the canvas."
                }
              />
            </div>
          )}
        </div>
        <section aria-label="Preview" className="max-h-[60vh] min-h-[240px] overflow-y-auto rounded-xl border border-line bg-bg p-4">
          <PreviewPane id={selected} detail={detail} error={error} />
        </section>
      </div>
    </Dialog>
  );
}
