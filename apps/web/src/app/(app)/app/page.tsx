"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy,
  ExternalLink,
  Inbox,
  LayoutTemplate,
  Loader2,
  LogOut,
  Plus,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  createForm,
  duplicateForm,
  generateForm,
  listForms,
  logout,
  me,
  type FormListItem,
  type User,
} from "@/lib/api";

const AI_EXAMPLES = [
  "A customer feedback survey with a rating",
  "Job application for a frontend engineer",
  "RSVP for a company offsite",
  "Bug report with severity and screenshot",
];

type Status = "loading" | "ok" | "error";

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: "bg-[#E7F6ED] text-green",
  DRAFT: "bg-surface-3 text-muted",
  CLOSED: "bg-[#FBF0D9] text-amber",
};

export default function Dashboard() {
  const router = useRouter();
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
    me().then(setUser).catch(() => {});
  }, []);

  async function onCreate() {
    setCreating(true);
    try {
      const f = await createForm("Untitled form");
      router.push(`/app/forms/${f.id}/edit`);
    } catch {
      setStatus("error");
      setCreating(false);
    }
  }

  async function onDuplicate(id: string) {
    try {
      await duplicateForm(id);
      refresh();
    } catch {
      /* ignore */
    }
  }

  async function onGenerate() {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const f = await generateForm(aiPrompt.trim());
      router.push(`/app/forms/${f.id}/edit`);
    } catch (e) {
      setAiError((e as Error).message || "Couldn't generate that form.");
      setAiBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg font-bold text-white">
          F
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">My forms</h1>
          <p className="text-sm text-muted">{user ? user.name || user.email : "Your workspace"}</p>
        </div>
        <Link href="/app/templates" className="btn btn-outline btn-sm">
          <LayoutTemplate className="h-4 w-4" />
          <span className="hidden sm:inline">Templates</span>
        </Link>
        <Link href="/app/integrations" className="btn btn-outline btn-sm">
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Integrations</span>
        </Link>
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="btn btn-outline btn-sm"
          title="Log out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log out</span>
        </button>
        <button
          onClick={() => {
            setAiError(null);
            setAiOpen(true);
          }}
          className="btn btn-outline btn-sm"
        >
          <Sparkles className="h-4 w-4 text-accent-2" />
          <span className="hidden sm:inline">Generate with AI</span>
        </button>
        <button onClick={onCreate} disabled={creating} className="btn btn-primary">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {creating ? "Creating…" : "New form"}
        </button>
      </header>

      {aiOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
          onClick={() => !aiBusy && setAiOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[#EFEDFE] text-accent-2">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <div className="flex-1">
                <h2 className="font-semibold tracking-tight">Generate a form with AI</h2>
                <p className="text-sm text-muted">
                  Describe what you need — we&apos;ll draft the questions for you.
                </p>
              </div>
              <button
                onClick={() => !aiBusy && setAiOpen(false)}
                className="text-muted hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <textarea
              autoFocus
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onGenerate();
              }}
              rows={3}
              placeholder="e.g. A customer feedback survey with a star rating and a comment box"
              className="input w-full resize-none"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {AI_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setAiPrompt(ex)}
                  className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-muted hover:border-line-2 hover:text-ink"
                >
                  {ex}
                </button>
              ))}
            </div>

            {aiError && (
              <p className="mt-3 rounded-lg bg-[#FCECEC] px-3 py-2 text-sm text-red">{aiError}</p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setAiOpen(false)}
                disabled={aiBusy}
                className="btn btn-outline btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={onGenerate}
                disabled={aiBusy || !aiPrompt.trim()}
                className="btn btn-primary btn-sm"
              >
                {aiBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {aiBusy ? "Generating…" : "Generate form"}
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">
          Couldn&apos;t reach the API. Start it with{" "}
          <code className="font-mono">pnpm dev</code> (with Postgres running), then reload.
        </div>
      )}

      {status === "ok" && forms.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center shadow-soft">
          <p className="mb-1 font-semibold">No forms yet</p>
          <p className="mb-5 text-sm text-muted">
            Start from scratch, or describe it and let AI draft the questions.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={onCreate} className="btn btn-accent">
              <Plus className="h-4 w-4" /> Create your first form
            </button>
            <button
              onClick={() => {
                setAiError(null);
                setAiOpen(true);
              }}
              className="btn btn-outline"
            >
              <Sparkles className="h-4 w-4 text-accent-2" /> Generate with AI
            </button>
          </div>
        </div>
      )}

      {status === "ok" && forms.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((f) => (
            <div
              key={f.id}
              className="group flex flex-col rounded-2xl border border-line bg-surface shadow-soft transition-shadow hover:shadow-pop"
            >
              <Link href={`/app/forms/${f.id}/edit`} className="flex-1 p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 font-semibold leading-snug tracking-tight">
                    {f.title}
                  </h3>
                  <span
                    className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[f.status] ?? STATUS_STYLE.DRAFT}`}
                  >
                    {f.status.charAt(0) + f.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted">
                  <Inbox className="h-4 w-4" />
                  {f._count?.responses ?? 0} responses
                </div>
              </Link>
              <div className="flex items-center justify-between border-t border-line px-5 py-2.5">
                <span className="truncate font-mono text-xs text-faint">/{f.slug}</span>
                <div className="flex flex-none items-center gap-3">
                  <button
                    onClick={() => onDuplicate(f.id)}
                    className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
                    title="Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                  {f.status === "PUBLISHED" && (
                    <a
                      href={`/r/${f.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-accent-2 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Live
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
