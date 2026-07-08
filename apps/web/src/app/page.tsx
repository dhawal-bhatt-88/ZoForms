"use client";

import { useEffect, useState } from "react";
import { createForm, listForms, type FormListItem } from "@/lib/api";

type Status = "loading" | "ok" | "error";

export default function Home() {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    try {
      setForms(await listForms());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate() {
    setCreating(true);
    try {
      await createForm("Untitled form");
      await refresh();
    } catch {
      setStatus("error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg font-bold text-white">
          F
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Frame</h1>
          <p className="text-sm text-muted">
            dev scaffold — the walking skeleton
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-line bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">Forms</h2>
          <button
            onClick={onCreate}
            disabled={creating}
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating…" : "+ New form"}
          </button>
        </div>

        <div className="p-5">
          {status === "loading" && (
            <p className="text-sm text-muted">Loading…</p>
          )}

          {status === "error" && (
            <div className="rounded-lg bg-[#FCECEC] px-4 py-3 text-sm text-[#DC4B47]">
              Couldn&apos;t reach the API. Start it with{" "}
              <code className="font-mono">docker compose up -d</code> →{" "}
              <code className="font-mono">pnpm db:migrate --name init</code> →{" "}
              <code className="font-mono">pnpm dev</code>, then reload.
            </div>
          )}

          {status === "ok" && forms.length === 0 && (
            <div className="py-10 text-center">
              <p className="mb-1 font-medium">No forms yet</p>
              <p className="mb-4 text-sm text-muted">
                Create your first form — it persists to Postgres via Prisma.
              </p>
              <button
                onClick={onCreate}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Create your first form
              </button>
            </div>
          )}

          {status === "ok" && forms.length > 0 && (
            <ul className="divide-y divide-line">
              {forms.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="font-medium">{f.title}</div>
                    <div className="font-mono text-xs text-muted">/{f.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent-2">
                      {f.status}
                    </span>
                    <span className="text-xs text-muted">
                      {f._count?.responses ?? 0} responses
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted">
        Next: port the builder from{" "}
        <code className="font-mono">frame-prototype.html</code> and add the
        public runtime at <code className="font-mono">/r/[slug]</code>. See{" "}
        <code className="font-mono">GETTING-STARTED.md</code>.
      </p>
    </main>
  );
}
