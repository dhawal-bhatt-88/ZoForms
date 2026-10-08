"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Eye,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Star,
  Upload,
  X,
} from "lucide-react";
import type { Block } from "@formbuilder/form-schema";
import AppShell from "@/components/app-shell";
import { createForm, saveSchema } from "@/lib/api";
import {
  CATEGORIES,
  COMMUNITY_TEMPLATES,
  TEMPLATES,
  TONE,
  type Template,
} from "@/lib/templates";

type Sort = "popular" | "newest" | "rated" | "az";
const SORTS: { id: Sort; label: string }[] = [
  { id: "popular", label: "Most popular" },
  { id: "newest", label: "Newest" },
  { id: "rated", label: "Top rated" },
  { id: "az", label: "Alphabetical" },
];

function usesToNum(uses: string): number {
  const n = parseFloat(uses);
  return uses.toLowerCase().includes("k") ? n * 1000 : n;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const [sortOpen, setSortOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);

  const featured = TEMPLATES.find((t) => t.featured) ?? TEMPLATES[0];
  const showFeatured = cat === "All" && !q.trim();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = TEMPLATES.filter((t) => {
      if (cat !== "All" && t.category !== cat) return false;
      if (needle) {
        const hay = `${t.name} ${t.category} ${t.description}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    // Don't repeat the featured card in the grid when the banner is visible.
    if (showFeatured) list = list.filter((t) => t.id !== featured.id);
    const sorted = [...list];
    if (sort === "popular") sorted.sort((a, b) => usesToNum(b.uses) - usesToNum(a.uses));
    else if (sort === "rated") sorted.sort((a, b) => b.rating - a.rating);
    else if (sort === "az") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.reverse();
    return sorted;
  }, [cat, q, sort, showFeatured, featured.id]);

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

  async function blank() {
    setBusy("__blank__");
    try {
      const f = await createForm("Untitled form");
      router.push(`/app/forms/${f.id}/edit`);
    } catch {
      setBusy(null);
    }
  }

  return (
    <AppShell
      title="Templates"
      actions={
        <>
          <button onClick={() => router.push("/app")} className="btn btn-outline btn-sm">
            <LayoutGrid className="h-4 w-4" /> My forms
          </button>
          <button onClick={blank} disabled={busy !== null} className="btn btn-primary btn-sm">
            {busy === "__blank__" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Blank form
          </button>
        </>
      }
    >
      <p className="mb-5 text-sm text-muted">Start faster with a proven form.</p>

      {/* Search + sort */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates by name, category, or use case"
            className="input w-full pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted">Sort</span>
          <div className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              onBlur={() => setTimeout(() => setSortOpen(false), 150)}
              className="btn btn-outline btn-sm"
            >
              {SORTS.find((s) => s.id === sort)!.label}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {sortOpen && (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-surface p-1 shadow-pop">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    onMouseDown={() => {
                      setSort(s.id);
                      setSortOpen(false);
                    }}
                    className={`flex w-full items-center rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface-2 ${
                      sort === s.id ? "font-semibold text-accent-2" : "text-ink-2"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Featured banner */}
      {showFeatured && (
        <div
          className="mb-7 overflow-hidden rounded-2xl"
          style={{
            background:
              "linear-gradient(120deg, #6D5EFA 0%, #5546E6 55%, #18181B 130%)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-6 p-7 sm:p-8">
            <div className="max-w-xl text-white">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[13px] font-semibold">
                <Sparkles className="h-3.5 w-3.5" /> Featured this week
              </span>
              <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight">
                {featured.name}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-white/85">
                {featured.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <button
                  onClick={() => use(featured)}
                  disabled={busy !== null}
                  className="btn btn-lg bg-white text-primary hover:opacity-90"
                >
                  {busy === featured.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Use template <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPreview(featured)}
                  className="btn btn-lg border border-white/40 text-white hover:bg-white/10"
                >
                  <Eye className="h-4 w-4" /> Preview
                </button>
              </div>
            </div>
            <div className="w-full max-w-[300px] rounded-2xl bg-surface p-4 shadow-pop">
              <MiniForm template={featured} />
            </div>
          </div>
        </div>
      )}

      {/* Category chips */}
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

      {/* Grid */}
      {shown.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              busy={busy === t.id}
              disabled={busy !== null}
              onUse={() => use(t)}
              onPreview={() => setPreview(t)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line-2 bg-surface-2 px-6 py-14 text-center">
          <p className="font-semibold">No templates match “{q}”</p>
          <p className="mt-1 text-sm text-muted">
            Try a different keyword or start from a blank form.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => { setQ(""); setCat("All"); }} className="btn btn-outline btn-sm">
              Clear search
            </button>
            <button onClick={blank} className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" /> Start blank
            </button>
          </div>
        </div>
      )}

      {/* Community templates */}
      {showFeatured && (
        <>
          <div className="mb-4 mt-11 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight">Community templates</h2>
                <span className="eyebrow">Community</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                Shared by builders in the Frame community — remix and make them your own.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMMUNITY_TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                t={t}
                busy={busy === t.id}
                disabled={busy !== null}
                onUse={() => use(t)}
                onPreview={() => setPreview(t)}
              />
            ))}
          </div>
        </>
      )}

      {preview && (
        <PreviewModal template={preview} onClose={() => setPreview(null)} onUse={() => use(preview)} busy={busy === preview.id} />
      )}
    </AppShell>
  );
}

/* ---------- template card ---------- */

function TemplateCard({
  t,
  busy,
  disabled,
  onUse,
  onPreview,
}: {
  t: Template;
  busy: boolean;
  disabled: boolean;
  onUse: () => void;
  onPreview: () => void;
}) {
  const tone = TONE[t.tone];
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-soft transition-shadow hover:shadow-pop">
      <div
        className="border-b border-line p-4"
        style={{ background: `linear-gradient(135deg, ${tone.from}, #FBFBFC)` }}
      >
        <div className="rounded-xl bg-surface p-3.5 shadow-soft">
          <MiniForm template={t} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold leading-snug tracking-tight">{t.name}</h3>
          <span className="flex-none rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
            {t.category}
          </span>
        </div>
        <div className="mb-3.5 flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber text-amber" /> {t.rating}
          </span>
          <span>{t.uses} uses</span>
        </div>
        <div className="mt-auto flex gap-2">
          <button onClick={onUse} disabled={disabled} className="btn btn-primary btn-sm flex-1 justify-center">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Creating…" : "Use template"}
          </button>
          <button onClick={onPreview} className="btn btn-outline btn-sm">
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- mini faux-form preview (derived from the real schema) ---------- */

function MiniForm({ template }: { template: Template }) {
  const tone = TONE[template.tone];
  const blocks = template.schema.blocks.filter((b) => b.type !== "heading").slice(0, 3);
  return (
    <div>
      <div
        className="mb-3 h-2 w-3/5 rounded-full"
        style={{ background: tone.line }}
      />
      <div className="space-y-2.5">
        {blocks.map((b) => (
          <div key={b.id}>
            <div className="mb-1 truncate text-[11.5px] font-medium text-ink">{b.label}</div>
            <MiniField block={b} accent={tone.accent} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniField({ block, accent }: { block: Block; accent: string }) {
  switch (block.type) {
    case "rating":
      return (
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={`h-3.5 w-3.5 ${i < 4 ? "fill-amber text-amber" : "text-faint"}`} />
          ))}
        </div>
      );
    case "scale": {
      const min = block.min ?? 0;
      const max = Math.min(block.max ?? 10, min + 10);
      const nums = [];
      for (let n = min; n <= max; n++) nums.push(n);
      const hi = nums[Math.floor(nums.length * 0.8)];
      return (
        <div className="flex flex-wrap gap-1">
          {nums.slice(0, 8).map((n) => (
            <span
              key={n}
              className="grid h-5 w-5 place-items-center rounded-md border border-line text-[10px] font-medium text-muted"
              style={n === hi ? { background: "#F0EEFE", color: "#5546E6", borderColor: "transparent" } : {}}
            >
              {n}
            </span>
          ))}
        </div>
      );
    }
    case "choice":
    case "dropdown":
    case "checkbox":
    case "multiselect":
      return (
        <div className="space-y-1.5">
          {(block.options ?? [{ code: "a", label: "Option" }, { code: "b", label: "Option" }]).slice(0, 2).map((o, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-3 w-3 flex-none rounded-[4px] border border-line-2" />
              <span className="h-2 rounded-full bg-line" style={{ width: `${45 + i * 20}%` }} />
            </div>
          ))}
        </div>
      );
    case "file":
      return (
        <div className="flex items-center gap-1.5 rounded-md border border-dashed border-line-2 px-2 py-1.5 text-[10.5px] text-muted">
          <Upload className="h-3 w-3" /> Upload a file
        </div>
      );
    case "date":
    case "time":
      return (
        <div className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[10.5px] text-muted">
          <Calendar className="h-3 w-3" /> Pick a {block.type === "time" ? "time" : "date"}
        </div>
      );
    case "long":
      return <div className="h-8 rounded-md bg-surface-3" />;
    default:
      return <div className="h-5 rounded-md bg-surface-3" />;
  }
}

/* ---------- full preview modal ---------- */

function PreviewModal({
  template,
  onClose,
  onUse,
  busy,
}: {
  template: Template;
  onClose: () => void;
  onUse: () => void;
  busy: boolean;
}) {
  const accent = template.schema.settings?.theme?.accent ?? TONE[template.tone].accent;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{template.name}</span>
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
              {template.category}
            </span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6" style={{ background: "#F6F7F9" }}>
          <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-6 shadow-soft">
            <h1 className="text-xl font-bold tracking-tight">{template.schema.title}</h1>
            {template.schema.description && (
              <p className="mt-1 text-sm text-muted">{template.schema.description}</p>
            )}
            <div className="mt-5 space-y-4">
              {template.schema.blocks
                .filter((b) => b.type !== "heading")
                .map((b) => (
                  <div key={b.id}>
                    <label className="mb-1.5 block text-sm font-semibold text-ink-2">
                      {b.label}
                      {b.required && <span className="text-red"> *</span>}
                    </label>
                    <PreviewField block={b} accent={accent} />
                  </div>
                ))}
            </div>
            <button
              className="mt-5 h-11 w-full rounded-lg text-[15px] font-semibold text-white"
              style={{ background: accent }}
              disabled
            >
              {template.schema.settings?.submitLabel ?? "Submit"}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            Close
          </button>
          <button onClick={onUse} disabled={busy} className="btn btn-primary btn-sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Use this template
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewField({ block, accent }: { block: Block; accent: string }) {
  const base = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted";
  switch (block.type) {
    case "long":
      return <div className={`${base} h-20`}>Long answer…</div>;
    case "rating":
      return (
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="h-6 w-6 text-faint" />
          ))}
        </div>
      );
    case "scale": {
      const min = block.min ?? 0;
      const max = Math.min(block.max ?? 10, min + 10);
      const nums = [];
      for (let n = min; n <= max; n++) nums.push(n);
      return (
        <div className="flex flex-wrap gap-1.5">
          {nums.map((n) => (
            <span
              key={n}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line text-sm text-ink-2"
            >
              {n}
            </span>
          ))}
        </div>
      );
    }
    case "choice":
    case "checkbox":
    case "multiselect":
      return (
        <div className="space-y-2">
          {(block.options ?? []).map((o, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-2">
              <span
                className="h-4 w-4 flex-none border border-line-2"
                style={{ borderRadius: block.type === "choice" ? "9999px" : "4px" }}
              />
              {o.label}
            </div>
          ))}
        </div>
      );
    case "dropdown":
      return (
        <div className={`${base} flex items-center justify-between`}>
          {block.options?.[0]?.label ?? "Select…"}
          <ChevronDown className="h-4 w-4" />
        </div>
      );
    case "file":
      return (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-line-2 px-3 py-4 text-sm text-muted">
          <Upload className="h-4 w-4" /> Upload a file
        </div>
      );
    case "date":
    case "time":
      return (
        <div className={`${base} flex items-center gap-2`}>
          <Calendar className="h-4 w-4" /> Pick a {block.type === "time" ? "time" : "date"}
        </div>
      );
    default:
      return <div className={base}>Short answer…</div>;
  }
}
