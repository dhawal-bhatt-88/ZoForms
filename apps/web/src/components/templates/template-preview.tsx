"use client";

import { useEffect, useState } from "react";
import { Callout, Loading, Skeleton } from "@/components/ui";
import type { FormSchema, GroupBlock } from "@formbuilder/form-schema";
import { StaticCanvas } from "@/components/form-editor/canvas-preview";
import { getTemplate, type TemplateDetail } from "@/lib/api";

/** A template's content, read-only, as the editor's canvas shows it. */
function TemplatePreview({ template }: { template: TemplateDetail }) {
  if (template.kind === "group") return <StaticCanvas blocks={[template.content as GroupBlock]} />;
  const form = template.content as FormSchema;
  return (
    <div>
      <div className="mb-4">
        <div className="text-[20px] font-bold tracking-tight">{form.title}</div>
        {form.description && <p className="body-sm mt-1 text-graphite">{form.description}</p>}
      </div>
      {form.blocks.length ? (
        <StaticCanvas blocks={form.blocks} />
      ) : (
        <p className="body-sm rounded-xl border border-dashed border-rule-strong py-8 text-center text-graphite">This form is empty.</p>
      )}
    </div>
  );
}

/**
 * A template's content, fetched by id, with each template fetched once. For
 * pickers that preview whichever template is chosen.
 */
export function useTemplateDetail(id: string | null) {
  const [cache, setCache] = useState<Record<string, TemplateDetail>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    if (!id || cache[id]) return;
    let live = true;
    getTemplate(id)
      .then((t) => live && setCache((c) => ({ ...c, [id]: t })))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [id, cache]);
  return { detail: id ? cache[id] : undefined, error };
}

/** The preview area of a picker: the chosen template, a spinner while it loads, or why it couldn't. */
export function PreviewPane({ id, detail, error }: { id: string | null; detail?: TemplateDetail; error: string | null }) {
  if (!id) return <p className="body-sm py-10 text-center text-graphite">Choose a template to preview it.</p>;
  if (error)
    return (
      <Callout tone="fail" title="Couldn't load this template">
        {error}
      </Callout>
    );
  if (!detail)
    return (
      <Loading label="Loading the preview" className="space-y-3 py-2">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </Loading>
    );
  return <TemplatePreview template={detail} />;
}
