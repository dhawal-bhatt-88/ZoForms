"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, Download, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import AppShell from "@/components/app-shell";
import { MenuButton, type MenuItem } from "@/components/menu-button";
import { NewFormDialog } from "@/components/templates/new-form-dialog";
import {
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  Input,
  Loading,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";
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

/**
 * My forms: a card grid, each card a link into the editor with a ⋯ menu.
 * Every action reports its outcome in a toast; delete asks first.
 */
export default function Dashboard() {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  // "New form": blank, or from a form template. Not offered to viewers.
  const [newFormOpen, setNewFormOpen] = useState(false);
  const canEdit = useCanEdit();
  const toast = useToast();
  const searchId = useId();
  const sortId = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [toDelete, setToDelete] = useState<FormListItem | null>(null);

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

  async function onDuplicate(f: FormListItem) {
    try {
      const copy = await duplicateForm(f.id);
      await refresh();
      toast.show({ tone: "pass", title: `Duplicated "${f.title}".`, detail: `The copy is "${copy.title}".` });
    } catch (e) {
      toast.show({ tone: "fail", title: `Couldn't duplicate "${f.title}".`, detail: (e as Error).message });
    }
  }

  async function onDownload(f: FormListItem) {
    try {
      const fileName = await downloadArtifact(f.id);
      toast.show({ tone: "pass", title: `Downloaded "${f.title}".`, detail: fileName });
    } catch (e) {
      toast.show({ tone: "fail", title: `Couldn't download "${f.title}".`, detail: (e as Error).message });
    }
  }

  const newForm = canEdit && (
    <Button variant="primary" onClick={() => setNewFormOpen(true)}>
      <Plus aria-hidden="true" className="h-4 w-4" />
      New form
    </Button>
  );

  return (
    <AppShell title="My forms" actions={newForm}>
      <div role="search" className="mb-6 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search forms
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-soft" />
          <Input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search forms…"
            className="pl-9"
          />
        </div>
        <label htmlFor={sortId} className="sr-only">
          Sort forms
        </label>
        <Select id={sortId} value={sort} onChange={(e) => setSort(e.target.value as Sort)} wrapperClassName="w-auto">
          <option value="recent">Recently edited</option>
          <option value="name">Name (A–Z)</option>
        </Select>
      </div>

      {status === "loading" && (
        <Loading label="Loading your forms" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="surface p-5">
              <Skeleton className="mb-4 h-9 w-9 rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-5 h-3 w-2/3" />
            </div>
          ))}
        </Loading>
      )}

      {status === "error" && (
        <Callout tone="fail" title="Couldn't load your forms">
          The API didn&apos;t answer. Start it with <code className="font-mono">pnpm dev</code> (with Postgres running),
          then reload.
        </Callout>
      )}

      {status === "ok" && forms.length === 0 && (
        <EmptyState
          title={canEdit ? "Create your first form" : "No forms yet"}
          body={
            canEdit
              ? "Start from scratch or from a template. Every save keeps a version you can go back to."
              : "Forms your organisation makes will appear here."
          }
          actions={newForm}
        />
      )}

      {status === "ok" && forms.length > 0 && visible.length === 0 && (
        <EmptyState
          title={`No forms match "${query.trim()}"`}
          body="Try another word, or clear the search to see every form."
          actions={<Button onClick={() => setQuery("")}>Clear search</Button>}
        />
      )}

      {status === "ok" && visible.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((f) => (
            <FormCard
              key={f.id}
              form={f}
              canEdit={canEdit}
              onDuplicate={() => onDuplicate(f)}
              onDownload={() => onDownload(f)}
              onDelete={() => setToDelete(f)}
            />
          ))}
        </ul>
      )}

      {newFormOpen && <NewFormDialog onClose={() => setNewFormOpen(false)} />}

      {toDelete && (
        <ConfirmDialog
          title={`Delete "${toDelete.title}"?`}
          consequence="This permanently removes the form and all its saved versions. Files you've already downloaded aren't affected. This can't be undone."
          confirmLabel="Delete form"
          onConfirm={async () => {
            await deleteForm(toDelete.id);
            setForms((list) => list.filter((x) => x.id !== toDelete.id));
            toast.show({ tone: "pass", title: `Deleted "${toDelete.title}".` });
            // Its card, and the ⋯ button that opened this, are gone: focus
            // would otherwise fall to the page itself.
            requestAnimationFrame(() => searchRef.current?.focus());
          }}
          onClose={() => setToDelete(null)}
        />
      )}
    </AppShell>
  );
}

/**
 * A form, as a card that is itself the link into the editor. The link covers
 * the card, so its focus ring follows the card's corners, and the title and
 * date sit beneath it so a click on them opens the form; only the ⋯ menu sits
 * above it. The hover lift is allowed here because the whole card is a link.
 */
function FormCard({
  form: f,
  canEdit,
  onDuplicate,
  onDownload,
  onDelete,
}: {
  form: FormListItem;
  canEdit: boolean;
  onDuplicate: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const href = `/app/forms/${f.id}/edit`;
  const open = canEdit ? "Edit" : "Open";
  const items: MenuItem[] = canEdit
    ? [
        { label: "Edit", icon: Pencil, href },
        { label: "Duplicate", icon: Copy, onSelect: onDuplicate },
        { label: "Download", icon: Download, onSelect: onDownload },
        "separator",
        { label: "Delete…", icon: Trash2, onSelect: onDelete, danger: true },
      ]
    : [
        { label: "Open", icon: FileText, href },
        { label: "Download", icon: Download, onSelect: onDownload },
      ];

  return (
    <li className="surface group relative flex flex-col p-5 transition-[transform,box-shadow,border-color] duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-rule-strong hover:shadow-[0_12px_32px_-16px_rgb(2_20_17/0.25)] motion-reduce:hover:translate-y-0">
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-[0.875rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        aria-label={`${open} ${f.title}`}
      />

      <span aria-hidden="true" className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-accent-wash text-brand-deep">
        <FileText className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>

      <h3 className="line-clamp-2 font-display text-[0.9375rem] font-semibold leading-snug tracking-[-0.008em]">
        {f.title}
      </h3>
      <p className="body-sm mt-1.5 text-graphite">Edited {relTime(f.updatedAt || f.createdAt)}</p>

      <div className="relative z-10 mt-4 flex items-center justify-end border-t border-rule pt-3">
        <MenuButton label={`More actions for "${f.title}"`} items={items} placement="above" />
      </div>
    </li>
  );
}
