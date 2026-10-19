"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, FileText, Layers, Pencil, PenLine, Trash2 } from "lucide-react";
import AppShell from "@/components/app-shell";
import { Dialog } from "@/components/dialog";
import { MenuButton } from "@/components/menu-button";
import { PreviewPane, useTemplateDetail } from "@/components/templates/template-preview";
import { filterTemplates, TemplateSearch } from "@/components/templates/template-list";
import {
  Button,
  buttonClasses,
  Callout,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Loading,
  Skeleton,
  StatusChip,
  Textarea,
  useToast,
} from "@/components/ui";
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
 * Viewers can browse and preview, and see no write actions. Every action
 * reports its outcome in a toast.
 */
export default function TemplatesPage() {
  const router = useRouter();
  const canEdit = useCanEdit();
  const toast = useToast();
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TemplateScope>("system");
  const [query, setQuery] = useState("");
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

  /** Run an action and say how it went: `run` returns the success message, or throws. */
  async function act(key: string, failure: string, run: () => Promise<string | void>) {
    setBusy(key);
    try {
      const message = await run();
      if (message) toast.show({ tone: "pass", title: message });
    } catch (e) {
      toast.show({ tone: "fail", title: failure, detail: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const use = (t: TemplateSummary) =>
    act(`use-${t.id}`, `Couldn't start a form from "${t.name}".`, async () => {
      const form = await createFormFromTemplate(t.id);
      router.push(`/app/forms/${form.id}/edit`);
    });

  const duplicate = (t: TemplateSummary) =>
    act(`duplicate-${t.id}`, `Couldn't duplicate "${t.name}".`, async () => {
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
    <AppShell
      title="Templates"
      lede={
        <>
          Start a form from a template, or insert a group template into a form with &ldquo;From template…&rdquo; in the
          editor. Templates are copied, never linked: changing one later doesn&apos;t change forms made from it.
        </>
      }
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        {/* The ARIA tabs pattern with one shared panel: arrows, Home and End
            move between tabs; the selected one is the only tab stop. */}
        <div role="tablist" aria-label="Templates" className="inline-flex items-center gap-0.5 rounded-lg border border-rule bg-paper-sunk p-0.5">
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
              className={`rounded-md px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-200 ${
                // Marked like the rail's current item: the wash and the accent
                // text, which stay distinct in both themes (paper on paper-sunk
                // all but disappears in dark).
                tab === scope ? "bg-accent-wash text-brand-deep shadow-sm" : "text-graphite hover:text-ink"
              }`}
            >
              {label}
              <span className={`tabular ml-1.5 ${tab === scope ? "text-brand-deep" : "text-graphite-soft"}`}>{count(scope)}</span>
            </button>
          ))}
        </div>
        <div className="w-full max-w-sm">
          <TemplateSearch value={query} onChange={setQuery} label="Search templates" />
        </div>
      </div>

      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${tab}`}>
        {loadError ? (
          <Callout tone="fail" title="Couldn't load templates">
            {loadError}
          </Callout>
        ) : !templates ? (
          <Loading label="Loading templates" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="surface p-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
                <Skeleton className="mt-6 h-8 w-1/2" />
              </div>
            ))}
          </Loading>
        ) : (
          (["form", "group"] as const).map((kind) => {
            const list = inTab.filter((t) => t.kind === kind);
            const title = kind === "form" ? "Forms" : "Groups";
            const Icon = kind === "form" ? FileText : Layers;
            return (
              <section key={kind} aria-labelledby={`${baseId}-${kind}`} className="mb-9">
                <h2 id={`${baseId}-${kind}`} className="mb-3 flex items-center gap-2 font-display text-[0.9375rem] font-semibold tracking-[-0.008em]">
                  <Icon aria-hidden="true" className="h-4 w-4 text-graphite-soft" />
                  {title}
                  <span className="tabular text-[0.8125rem] font-normal text-graphite-soft">{list.length}</span>
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
                  <EmptyState className="py-8" {...emptyText(kind, tab, query.trim(), canEdit)} />
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
            toast.show({ tone: "pass", title: `Saved the name and description of "${t.name}".` });
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.name}"?`}
          consequence="Forms already made from it, or with it inserted, don't change. This can't be undone."
          confirmLabel="Delete template"
          onConfirm={async () => {
            await deleteTemplate(deleting.id);
            await refresh();
            toast.show({ tone: "pass", title: `Deleted "${deleting.name}".` });
            // The card and its ⋯ button are gone; the tab is the nearest place to stand.
            requestAnimationFrame(() => tabRefs.current[tab]?.focus());
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </AppShell>
  );
}

/** What an empty section says, and what to do about it. */
function emptyText(kind: "form" | "group", tab: TemplateScope, query: string, canEdit: boolean): { title: string; body?: string } {
  if (query) return { title: `No ${kind} templates match "${query}".`, body: "Try another word, or clear the search." };
  if (tab === "system") return { title: `There are no system ${kind} templates yet.` };
  if (!canEdit) return { title: `Your organisation has no ${kind} templates yet.` };
  return kind === "form"
    ? {
        title: "No form templates yet.",
        body: "In the form editor, choose Save form as template from the ⋯ menu, or duplicate a system template.",
      }
    : { title: "No group templates yet.", body: "On the canvas, choose Save as template from a group's ⋯ menu." };
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
    <li className="surface flex flex-col p-5" data-template-id={t.id}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h3 className="font-display text-[0.9375rem] font-semibold leading-snug tracking-[-0.008em]">{t.name}</h3>
        <StatusChip className="flex-none">{t.kind === "form" ? "Form" : "Group"}</StatusChip>
      </div>
      <div className="flex-1">
        {t.description && <p className="body-sm line-clamp-3 text-graphite">{t.description}</p>}
        <p className="mt-2 text-[0.75rem] text-graphite-soft">Updated {updated(t.updatedAt)}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
        <Button size="sm" onClick={onPreview} aria-label={`Preview "${t.name}"`}>
          <Eye aria-hidden="true" className="h-3.5 w-3.5" /> Preview
        </Button>
        {canEdit && t.kind === "form" && (
          <Button variant="primary" size="sm" onClick={onUse} pending={busy === `use-${t.id}`} aria-label={`Use "${t.name}" for a new form`}>
            Use
          </Button>
        )}
        {!canEdit ? null : own ? (
          <>
            <Link href={`/app/templates/${t.id}/edit`} className={buttonClasses({ size: "sm" })} aria-label={`Edit "${t.name}"`}>
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Edit
            </Link>
            <div className="ml-auto">
              <MenuButton
                label={`More actions for "${t.name}"`}
                placement="above"
                items={[
                  { label: "Rename…", icon: PenLine, onSelect: onRename },
                  { label: "Duplicate", icon: Copy, onSelect: onDuplicate },
                  "separator",
                  { label: "Delete…", icon: Trash2, onSelect: onDelete, danger: true },
                ]}
              />
            </div>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDuplicate}
            pending={busy === `duplicate-${t.id}`}
            title="Duplicate to my templates"
            aria-label={`Duplicate "${t.name}" to my templates`}
          >
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            Duplicate
          </Button>
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
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
          {!canEdit ? null : t.scope === "system" ? (
            <Button size="sm" onClick={onDuplicate} pending={busy === `duplicate-${t.id}`}>
              <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Duplicate to my templates
            </Button>
          ) : (
            <Link href={`/app/templates/${t.id}/edit`} className={buttonClasses({ size: "sm" })}>
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Edit
            </Link>
          )}
          {canEdit && t.kind === "form" && (
            <Button variant="primary" size="sm" onClick={onUse} pending={busy === `use-${t.id}`}>
              Use for a new form
            </Button>
          )}
        </>
      }
    >
      <section aria-label="Preview" className="rounded-xl border border-rule bg-paper p-4">
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
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blank = !name.trim();

  async function save() {
    if (blank || saving) return;
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
          <Button size="sm" onClick={() => !saving && onClose()} aria-disabled={saving || undefined}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} pending={saving} reason={blank ? "A template needs a name." : undefined}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name" required>
          {(field) => <Input {...field} data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Description">
          {(field) => (
            <Textarea {...field} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
          )}
        </Field>
      </form>
      {error && (
        <Callout role="alert" tone="fail" title="Couldn't save" className="mt-4">
          {error}
        </Callout>
      )}
    </Dialog>
  );
}
