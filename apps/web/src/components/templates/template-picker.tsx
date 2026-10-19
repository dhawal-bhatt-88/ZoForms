"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/dialog";
import { Button, Callout, Loading, Skeleton } from "@/components/ui";
import { listTemplates, type TemplateDetail, type TemplateSummary } from "@/lib/api";
import { PreviewPane, useTemplateDetail } from "./template-preview";
import { filterTemplates, TemplateChoices, TemplateSearch } from "./template-list";

/**
 * "From template…": choose a group template — system ones and the
 * organisation's — preview it, and insert it as a group, or as a new page.
 * "Insert as page" is offered only when `asPage` is null; otherwise it stays
 * focusable but blocked, with `asPage` as the reason shown under it and bound
 * to it (`Button`'s `reason`).
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
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => detail && onInsert(detail, "page")}
            reason={asPage ?? (!detail ? "Choose a template first." : undefined)}
          >
            Insert as page
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => detail && onInsert(detail, "group")}
            reason={!detail ? "Choose a template first." : undefined}
          >
            Insert as group
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <TemplateSearch value={query} onChange={setQuery} label="Search group templates" />
          {loadError ? (
            <Callout tone="fail" title="Couldn't load templates">
              {loadError}
            </Callout>
          ) : !templates ? (
            <Loading label="Loading templates" className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </Loading>
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
        <section aria-label="Preview" className="max-h-[60vh] min-h-[240px] overflow-y-auto rounded-xl border border-rule bg-paper p-4">
          <PreviewPane id={selected} detail={detail} error={error} />
        </section>
      </div>
    </Dialog>
  );
}
