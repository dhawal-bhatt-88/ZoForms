"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { createForm, saveSchema } from "@/lib/api";
import { CATEGORIES, TEMPLATES, type Template } from "@/lib/templates";

export default function TemplatesPage() {
  const router = useRouter();
  const [cat, setCat] = useState<string>("All");
  const [busy, setBusy] = useState<string | null>(null);

  const shown = cat === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat);

  async function use(t: Template) {
    setBusy(t.id);
    try {
      const f = await createForm(t.schema.title);
      await saveSchema(f.id, t.schema);
      router.push(`/app/forms/${f.id}/edit`);
    } catch {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-center gap-3">
        <Link
          href="/app"
          className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-2 hover:bg-surface-3"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted">Start faster with a proven form.</p>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              cat === c
                ? "bg-primary text-white"
                : "border border-line-2 bg-surface text-ink-2 hover:bg-surface-3"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded-2xl border border-line bg-surface shadow-soft"
          >
            <div
              className="flex h-24 items-center justify-center rounded-t-2xl text-lg font-bold text-white"
              style={{ background: t.schema.settings?.theme?.accent ?? "#6D5EFA" }}
            >
              {t.schema.title}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold tracking-tight">{t.name}</h3>
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {t.category}
                </span>
              </div>
              <p className="mb-4 flex-1 text-sm text-muted">{t.description}</p>
              <button
                onClick={() => use(t)}
                disabled={busy !== null}
                className="btn btn-primary btn-sm w-full disabled:opacity-60"
              >
                {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy === t.id ? "Creating…" : "Use template"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
