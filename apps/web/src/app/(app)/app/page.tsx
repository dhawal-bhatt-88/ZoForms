"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Inbox,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  Download,
} from "lucide-react";
import AppShell from "@/components/app-shell";
import { NewFormDialog } from "@/components/templates/new-form-dialog";
import {
  deleteForm,
  downloadArtifact,
  duplicateForm,
  generateForm,
  listForms,
  type FormListItem,
  type FormStatus,
} from "@/lib/api";

const AI_EXAMPLES = [
  "A customer feedback survey with a rating",
  "Job application for a frontend engineer",
  "RSVP for a company offsite",
  "Bug report with severity and screenshot",
];

const STATUS: Record<FormStatus, { label: string; dot: string; cls: string }> = {
  PUBLISHED: { label: "Live", dot: "bg-green", cls: "bg-[#E7F6ED] text-green" },
  DRAFT: { label: "Draft", dot: "bg-[#9AA0AA]", cls: "bg-surface-3 text-muted" },
  CLOSED: { label: "Closed", dot: "bg-amber", cls: "bg-[#FBF0D9] text-amber" },
};

function relTime(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}

type Sort = "recent" | "name" | "responses";

export default function Dashboard() {
  const router = useRouter();
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  // "New form": blank, or from a form template.
  const [newFormOpen, setNewFormOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | FormStatus>("all");
  const [sort, setSort] = useState<Sort>("recent");

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<FormListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const visible = useMemo(() => {
    let list = forms;
    if (filter !== "all") list = list.filter((f) => f.status === filter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((f) => f.title.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "responses")
      sorted.sort((a, b) => (b._count?.responses ?? 0) - (a._count?.responses ?? 0));
    else
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );
    return sorted;
  }, [forms, filter, query, sort]);

  function onCreate() {
    setNewFormOpen(true);
  }

  async function onDuplicate(id: string) {
    try {
      await duplicateForm(id);
      refresh();
    } catch {
      /* ignore */
    }
  }

  async function onDownload(id: string) {
    try {
      await downloadArtifact(id);
    } catch {
      /* ignore */
    }
  }

  async function onConfirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteForm(toDelete.id);
      setForms((f) => f.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
    } finally {
      setDeleting(false);
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

  const counts = useMemo(
    () => ({
      all: forms.length,
      PUBLISHED: forms.filter((f) => f.status === "PUBLISHED").length,
      DRAFT: forms.filter((f) => f.status === "DRAFT").length,
    }),
    [forms],
  );

  return (
    <AppShell
      title="My forms"
      actions={
        <>
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
          <button onClick={onCreate} className="btn btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            New form
          </button>
        </>
      }
    >
      {/* toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search forms…"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
          {(["all", "PUBLISHED", "DRAFT"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                filter === k ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {k === "all" ? "All" : k === "PUBLISHED" ? "Live" : "Drafts"}
              <span className={`ml-1.5 tabular-nums ${filter === k ? "text-white/60" : "text-faint"}`}>
                {counts[k as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 outline-none focus:border-accent"
        >
          <option value="recent">Recently edited</option>
          <option value="name">Name (A–Z)</option>
          <option value="responses">Most responses</option>
        </select>
      </div>

      {status === "loading" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="h-9 w-9 animate-pulse rounded-xl bg-surface-3" />
                <div className="h-5 w-14 animate-pulse rounded-full bg-surface-3" />
              </div>
              <div className="h-4 w-3/4 animate-pulse rounded bg-surface-3" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-surface-3" />
              <div className="mt-5 h-3 w-2/3 animate-pulse rounded bg-surface-3" />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">
          Couldn&apos;t reach the API. Start it with{" "}
          <code className="font-mono">pnpm dev</code> (with Postgres running), then reload.
        </div>
      )}

      {status === "ok" && forms.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-2 bg-surface py-16 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent-weak text-accent-2">
            <FileText className="h-5 w-5" />
          </div>
          <p className="mb-1 font-semibold">Create your first form</p>
          <p className="mb-5 text-sm text-muted">
            Start from scratch, or describe it and let AI draft the questions.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={onCreate} className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" /> New form
            </button>
            <button
              onClick={() => {
                setAiError(null);
                setAiOpen(true);
              }}
              className="btn btn-outline btn-sm"
            >
              <Sparkles className="h-4 w-4 text-accent-2" /> Generate with AI
            </button>
          </div>
        </div>
      )}

      {status === "ok" && forms.length > 0 && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-2 py-16 text-center text-sm text-muted">
          No forms match your filters.
        </div>
      )}

      {status === "ok" && visible.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((f) => (
            <FormCard
              key={f.id}
              form={f}
              onDuplicate={() => onDuplicate(f.id)}
              onDownload={() => onDownload(f.id)}
              onDelete={() => setToDelete(f)}
            />
          ))}
        </div>
      )}

      {/* AI modal */}
      {aiOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
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
                  className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-muted transition-colors hover:border-line-2 hover:text-ink"
                >
                  {ex}
                </button>
              ))}
            </div>
            {aiError && (
              <p className="mt-3 rounded-lg bg-[#FCECEC] px-3 py-2 text-sm text-red">{aiError}</p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setAiOpen(false)} disabled={aiBusy} className="btn btn-outline btn-sm">
                Cancel
              </button>
              <button
                onClick={onGenerate}
                disabled={aiBusy || !aiPrompt.trim()}
                className="btn btn-primary btn-sm"
              >
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiBusy ? "Generating…" : "Generate form"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newFormOpen && <NewFormDialog onClose={() => setNewFormOpen(false)} />}

      {/* delete confirm */}
      {toDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => !deleting && setToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#FCECEC] text-red">
              <Trash2 className="h-5 w-5" />
            </div>
            <h2 className="font-semibold tracking-tight">Delete “{toDelete.title}”?</h2>
            <p className="mt-1 text-sm text-muted">
              This permanently removes the form and all its responses. This can&apos;t be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setToDelete(null)} disabled={deleting} className="btn btn-outline btn-sm">
                Cancel
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={deleting}
                className="btn btn-sm bg-red text-white hover:opacity-90"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function FormCard({
  form: f,
  onDuplicate,
  onDownload,
  onDelete,
}: {
  form: FormListItem;
  onDuplicate: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const st = STATUS[f.status] ?? STATUS.DRAFT;

  function copyLink() {
    const url = `${window.location.origin}/r/${f.slug}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setMenu(false);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="group relative flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-pop">
      <Link href={`/app/forms/${f.id}/edit`} className="absolute inset-0 z-0 rounded-2xl" aria-label={`Edit ${f.title}`} />

      <div className="relative z-[1] mb-4 flex items-start justify-between gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted transition-colors group-hover:bg-accent-weak group-hover:text-accent-2">
          <FileText className="h-[18px] w-[18px]" />
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
      </div>

      <h3 className="relative z-[1] line-clamp-2 font-semibold leading-snug tracking-tight">
        {f.title}
      </h3>
      <div className="relative z-[1] mt-1.5 flex items-center gap-2 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Inbox className="h-3.5 w-3.5" />
          {f._count?.responses ?? 0}
        </span>
        <span className="text-faint">·</span>
        <span>Edited {relTime(f.updatedAt || f.createdAt)}</span>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="truncate font-mono text-xs text-faint">/{f.slug}</span>
        <div className="flex flex-none items-center gap-1">
          {f.status === "PUBLISHED" && (
            <a
              href={`/r/${f.slug}`}
              target="_blank"
              rel="noreferrer"
              className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-accent-2"
              title="View live"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <div className="relative">
            <button
              onClick={() => setMenu((v) => !v)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              title="More"
            >
              {copied ? <Check className="h-4 w-4 text-green" /> : <MoreHorizontal className="h-4 w-4" />}
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
                <div className="absolute bottom-9 right-0 z-30 w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                  <MenuItem icon={Pencil} label="Edit" href={`/app/forms/${f.id}/edit`} />
                  {f.status === "PUBLISHED" && (
                    <MenuItem icon={Link2} label="Copy link" onClick={copyLink} />
                  )}
                  <MenuItem
                    icon={Copy}
                    label="Duplicate"
                    onClick={() => {
                      onDuplicate();
                      setMenu(false);
                    }}
                  />
                  <div className="my-1 h-px bg-line" />
                  <MenuItem
                    icon={Trash2}
                    label="Delete"
                    danger
                    onClick={() => {
                      onDelete();
                      setMenu(false);
                    }}
                  />
                  <MenuItem
                    icon={Download}
                    label="Download"
                    onClick={() => {
                      onDownload();
                      setMenu(false);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const cls = `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] font-medium transition-colors ${
    danger ? "text-red hover:bg-[#FCECEC]" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
  }`;
  if (href)
    return (
      <Link href={href} className={cls}>
        <Icon className="h-4 w-4" /> {label}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
