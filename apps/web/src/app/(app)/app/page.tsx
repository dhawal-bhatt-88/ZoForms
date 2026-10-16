"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Copy,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Download,
} from "lucide-react";
import AppShell from "@/components/app-shell";
import { NewFormDialog } from "@/components/templates/new-form-dialog";
import { useCanEdit } from "@/lib/use-can-edit";
import {
  deleteForm,
  downloadArtifact,
  duplicateForm,
  listForms,
  type FormListItem,
} from "@/lib/api";

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

type Sort = "recent" | "name";

export default function Dashboard() {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  // "New form": blank, or from a form template. Not offered to viewers.
  const [newFormOpen, setNewFormOpen] = useState(false);
  const canEdit = useCanEdit();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

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
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((f) => f.title.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );
    return sorted;
  }, [forms, query, sort]);

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

  return (
    <AppShell
      title="My forms"
      actions={
        canEdit && (
          <button onClick={onCreate} className="btn btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            New form
          </button>
        )
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 outline-none focus:border-accent"
        >
          <option value="recent">Recently edited</option>
          <option value="name">Name (A–Z)</option>
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
            Start from scratch or from a template.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {canEdit && (
              <button onClick={onCreate} className="btn btn-primary btn-sm">
                <Plus className="h-4 w-4" /> New form
              </button>
            )}
          </div>
        </div>
      )}

      {status === "ok" && forms.length > 0 && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-2 py-16 text-center text-sm text-muted">
          No forms match your search.
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
              This permanently removes the form and all its versions. This can&apos;t be undone.
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

  return (
    <div className="group relative flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-pop">
      <Link href={`/app/forms/${f.id}/edit`} className="absolute inset-0 z-0 rounded-2xl" aria-label={`Edit ${f.title}`} />

      <div className="relative z-[1] mb-4 flex items-start justify-between gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted transition-colors group-hover:bg-accent-weak group-hover:text-accent-2">
          <FileText className="h-[18px] w-[18px]" />
        </span>
      </div>

      <h3 className="relative z-[1] line-clamp-2 font-semibold leading-snug tracking-tight">
        {f.title}
      </h3>
      <div className="relative z-[1] mt-1.5 flex items-center gap-2 text-[13px] text-muted">
        <span>Edited {relTime(f.updatedAt || f.createdAt)}</span>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-end border-t border-line pt-3">
        <div className="flex flex-none items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setMenu((v) => !v)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              title="More"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
                <div className="absolute bottom-9 right-0 z-30 w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                  <MenuItem icon={Pencil} label="Edit" href={`/app/forms/${f.id}/edit`} />
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
