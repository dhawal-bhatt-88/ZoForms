"use client";

import { useParams } from "next/navigation";
import FormEditor from "@/components/form-editor/editor";

/** A template, in the form editor's template mode. */
export default function TemplateEditorPage() {
  const params = useParams();
  return <FormEditor templateId={String(params.id)} />;
}
