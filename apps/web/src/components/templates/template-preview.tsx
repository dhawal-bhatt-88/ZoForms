"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
        {form.description && <p className="mt-1 text-sm text-muted">{form.description}</p>}
      </div>
      {form.blocks.length ? (
        <StaticCanvas blocks={form.blocks} />
      ) : (
        <p className="rounded-xl border border-dashed border-line-2 py-8 text-center text-sm text-muted">This form is empty.</p>
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
  if (!id) return <p className="py-10 text-center text-sm text-muted">Choose a template to preview it.</p>;
  if (error) return <p className="rounded-lg bg-[#FCECEC] px-3 py-2 text-sm text-red">Couldn&apos;t load this template: {error}</p>;
  if (!detail)
    return (
      <div className="grid place-items-center py-10 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading the preview" />
      </div>
    );
  return <TemplatePreview template={detail} />;
}
