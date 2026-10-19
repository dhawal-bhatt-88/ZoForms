"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, FileText, Layers, Loader2, Pencil, PenLine, Trash2 } from "lucide-react";
import AppShell from "@/components/app-shell";
import { Dialog } from "@/components/dialog";
import { MenuButton } from "@/components/menu-button";
import { PreviewPane, useTemplateDetail } from "@/components/templates/template-preview";
import { filterTemplates, TemplateSearch } from "@/components/templates/template-list";
import { useCanEdit } from "@/lib/use-can-edit";
import {
  createFormFromTemplate,
  deleteTemplate,
  duplicateTemplate,
  listTemplates,
  updateTemplate,
  type TemplateScope,
  type TemplateSummary,
} from "@/lib/api";

const TABS: { scope: TemplateScope; label: string }[] = [
  { scope: "system", label: "System" },
  { scope: "organisation", label: "Your organisation" },
];

const updated = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Templates: the system templates everyone can use, and the organisation's
 * own, which its authors edit, rename, duplicate and delete. Each tab lists
 * form templates and group templates separately. A form template starts a new
 * form; a group template is inserted from the form editor ("From template…").
 * Viewers can browse and preview, and see no write actions.
 */
export default function TemplatesPage() {
  const router = useRouter();
  const canEdit = useCanEdit();
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TemplateScope>("system");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<TemplateSummary | null>(null);
  const [renaming, setRenaming] = useState<TemplateSummary | null>(null);
  const [deleting, setDeleting] = useState<TemplateSummary | null>(null);
  const tabRefs = useRef<Record<TemplateScope, HTMLButtonElement | null>>({ system: null, organisation: null });
  const baseId = useId();

  async function refresh() {
    try {
      setTemplates(await listTemplates());
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  const inTab = useMemo(
    () => filterTemplates((templates ?? []).filter((t) => t.scope === tab), query),
    [templates, tab, query],
  );
  const count = (scope: TemplateScope) => (templates ?? []).filter((t) => t.scope === scope).length;

  /** Run an action, showing what happened in the status line, or why it failed. */
  async function act(key: string, run: () => Promise<string | void>) {
    setBusy(key);
    setError(null);
    setStatus("");
    try {
      const message = await run();
      if (message) setStatus(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const use = (t: TemplateSummary) =>
    act(`use-${t.id}`, async () => {
      const form = await createFormFromTemplate(t.id);
      router.push(`/app/forms/${form.id}/edit`);
    });

  const duplicate = (t: TemplateSummary) =>
    act(`duplicate-${t.id}`, async () => {
      const copy = await duplicateTemplate(t.id);
      await refresh();
      setTab("organisation");
      return `Copied to your organisation's templates as "${copy.name}".`;
    });

  function onTabKey(e: React.KeyboardEvent, at: number) {
    const to = e.key === "ArrowRight" ? at + 1 : e.key === "ArrowLeft" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const next = TABS[(to + TABS.length) % TABS.length].scope;
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <AppShell title="Templates">
      <p className="mb-5 text-sm text-muted">
        Start a form from a template, or insert a group template into a form with &ldquo;From template…&rdquo; in the
        editor. Templates are copied, never linked: changing one later doesn&apos;t change forms made from it.
      </p>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Templates" className="flex gap-1 rounded-lg border border-line bg-surface p-0.5">
          {TABS.map(({ scope, label }, i) => (
            <button
              key={scope}
              ref={(el) => {
                tabRefs.current[scope] = el;
              }}
              role="tab"
              id={`${baseId}-tab-${scope}`}
              aria-selected={tab === scope}
              aria-controls={`${baseId}-panel`}
              tabIndex={tab === scope ? 0 : -1}
              onClick={() => setTab(scope)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === scope ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {label}
              <span className={`ml-1.5 tabular-nums ${tab === scope ? "text-paper/60" : "text-faint"}`}>{count(scope)}</span>
            </button>
          ))}
        </div>
        <div className="w-full max-w-sm">
          <TemplateSearch value={query} onChange={setQuery} label="Search templates" />
        </div>
      </div>

      <p role="status" className={status ? "mb-4 rounded-lg bg-pass-wash px-3 py-2 text-sm text-green" : "sr-only"}>
        {status}
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-fail-wash px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}

      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${tab}`}>
        {loadError ? (
          <p className="rounded-lg bg-fail-wash px-3 py-2 text-sm text-red">Couldn&apos;t load templates: {loadError}</p>
        ) : !templates ? (
          <div className="grid place-items-center py-16 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading templates" />
          </div>
        ) : (
          (["form", "group"] as const).map((kind) => {
            const list = inTab.filter((t) => t.kind === kind);
            const title = kind === "form" ? "Forms" : "Groups";
            return (
              <section key={kind} aria-labelledby={`${baseId}-${kind}`} className="mb-9">
                <h2 id={`${baseId}-${kind}`} className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight">
                  {kind === "form" ? <FileText className="h-4 w-4 text-muted" /> : <Layers className="h-4 w-4 text-muted" />}
                  {title}
                  <span className="text-sm font-normal text-faint">{list.length}</span>
                </h2>
                {list.length ? (
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        canEdit={canEdit}
                        busy={busy}
                        onPreview={() => setPreviewing(t)}
                        onUse={() => use(t)}
                        onDuplicate={() => duplicate(t)}
                        onRename={() => setRenaming(t)}
                        onDelete={() => setDeleting(t)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-2xl border border-dashed border-line-2 px-6 py-8 text-center text-sm text-muted">
                    {query.trim()
                      ? `No ${kind} templates match "${query.trim()}".`
                      : tab === "system"
                        ? `There are no system ${kind} templates yet.`
                        : !canEdit
                          ? `Your organisation has no ${kind} templates yet.`
                          : kind === "form"
                          ? "No form templates yet. In the form editor, choose Save form as template from the ⋯ menu, or duplicate a system template."
                          : "No group templates yet. On the canvas, choose Save as template from a group's ⋯ menu."}
                  </p>
                )}
              </section>
            );
          })
        )}
      </div>

      {previewing && (
        <PreviewDialog
          template={previewing}
          canEdit={canEdit}
          busy={busy}
          onClose={() => setPreviewing(null)}
          onUse={() => use(previewing)}
          onDuplicate={() => {
            setPreviewing(null);
            duplicate(previewing);
          }}
        />
      )}
      {renaming && (
        <RenameDialog
          template={renaming}
          onClose={() => setRenaming(null)}
          onRenamed={async (t) => {
            setRenaming(null);
            await refresh();
            setStatus(`Saved the name and description of "${t.name}".`);
          }}
        />
      )}
      {deleting && (
        <Dialog
          title={`Delete "${deleting.name}"?`}
          description="Forms already made from it, or with it inserted, don't change. This can't be undone."
          onClose={() => setDeleting(null)}
          busy={busy === `delete-${deleting.id}`}
          width="max-w-sm"
          footer={
            <>
              <button onClick={() => setDeleting(null)} disabled={!!busy} className="btn btn-outline btn-sm">
                Cancel
              </button>
              <button
                onClick={() =>
                  act(`delete-${deleting.id}`, async () => {
                    await deleteTemplate(deleting.id);
                    const name = deleting.name;
                    setDeleting(null);
                    await refresh();
                    return `Deleted "${name}".`;
                  })
                }
                disabled={!!busy}
                className="btn btn-sm bg-red text-paper hover:opacity-90"
              >
                {busy === `delete-${deleting.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </>
          }
        />
      )}
    </AppShell>
  );
}

function TemplateCard({
  template: t,
  canEdit,
  busy,
  onPreview,
  onUse,
  onDuplicate,
  onRename,
  onDelete,
}: {
  template: TemplateSummary;
  /** False for a viewer: no write actions. */
  canEdit: boolean;
  busy: string | null;
  onPreview: () => void;
  onUse: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const own = t.scope === "organisation";
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]" data-template-id={t.id}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug tracking-tight">{t.name}</h3>
        <span className="flex-none rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
          {t.kind === "form" ? "Form" : "Group"}
        </span>
      </div>
      <div className="flex-1">
        {t.description && <p className="line-clamp-3 text-sm text-muted">{t.description}</p>}
        <p className="mt-2 text-xs text-faint">Updated {updated(t.updatedAt)}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button onClick={onPreview} className="btn btn-outline btn-sm" aria-label={`Preview "${t.name}"`}>
          <Eye className="h-4 w-4" /> Preview
        </button>
        {canEdit && t.kind === "form" && (
          <button onClick={onUse} disabled={!!busy} className="btn btn-primary btn-sm" aria-label={`Use "${t.name}" for a new form`}>
            {busy === `use-${t.id}` && <Loader2 className="h-4 w-4 animate-spin" />}
            Use
          </button>
        )}
        {!canEdit ? null : own ? (
          <>
            <Link href={`/app/templates/${t.id}/edit`} className="btn btn-outline btn-sm" aria-label={`Edit "${t.name}"`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
            <div className="ml-auto">
              <MenuButton
                label={`More actions for "${t.name}"`}
                items={[
                  { label: "Rename…", icon: PenLine, onSelect: onRename },
                  { label: "Duplicate", icon: Copy, onSelect: onDuplicate },
                  { label: "Delete…", icon: Trash2, onSelect: onDelete },
                ]}
              />
            </div>
          </>
        ) : (
          <button
            onClick={onDuplicate}
            disabled={!!busy}
            className="btn btn-ghost btn-sm"
            title="Duplicate to my templates"
            aria-label={`Duplicate "${t.name}" to my templates`}
          >
            {busy === `duplicate-${t.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Duplicate
          </button>
        )}
      </div>
    </li>
  );
}

function PreviewDialog({
  template: t,
  canEdit,
  busy,
  onClose,
  onUse,
  onDuplicate,
}: {
  template: TemplateSummary;
  /** False for a viewer: no write actions. */
  canEdit: boolean;
  busy: string | null;
  onClose: () => void;
  onUse: () => void;
  onDuplicate: () => void;
}) {
  const { detail, error } = useTemplateDetail(t.id);
  return (
    <Dialog
      title={t.name}
      description={`${t.scope === "system" ? "System" : "Your organisation's"} ${t.kind} template${t.description ? ` — ${t.description}` : ""}`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="btn btn-outline btn-sm">
            Close
          </button>
          {!canEdit ? null : t.scope === "system" ? (
            <button onClick={onDuplicate} disabled={!!busy} className="btn btn-outline btn-sm">
              <Copy className="h-4 w-4" /> Duplicate to my templates
            </button>
          ) : (
            <Link href={`/app/templates/${t.id}/edit`} className="btn btn-outline btn-sm">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          )}
          {canEdit && t.kind === "form" && (
            <button onClick={onUse} disabled={!!busy} className="btn btn-primary btn-sm">
              {busy === `use-${t.id}` && <Loader2 className="h-4 w-4 animate-spin" />}
              Use for a new form
            </button>
          )}
        </>
      }
    >
      <section aria-label="Preview" className="rounded-xl border border-line bg-bg p-4">
        <PreviewPane id={t.id} detail={detail} error={error} />
      </section>
    </Dialog>
  );
}

function RenameDialog({
  template: t,
  onClose,
  onRenamed,
}: {
  template: TemplateSummary;
  onClose: () => void;
  onRenamed: (t: TemplateSummary) => void;
}) {
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      onRenamed(await updateTemplate(t.id, { name: name.trim(), description: description.trim() || null }));
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog
      title={`Rename "${t.name}"`}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn btn-outline btn-sm">
            Cancel
          </button>
          <button onClick={save} disabled={saving || !name.trim()} className="btn btn-primary btn-sm">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor={nameId} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
          Name
        </label>
        <input
          id={nameId}
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          required
          className="input mb-3 w-full"
        />
        <label htmlFor={descriptionId} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={descriptionId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          className="input w-full resize-none"
        />
      </form>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-fail-wash px-3 py-2 text-sm text-red">
          Couldn&apos;t save: {error}
        </p>
      )}
    </Dialog>
  );
}
