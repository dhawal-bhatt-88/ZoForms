"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlignLeft,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleDot,
  Copy,
  ExternalLink,
  Hash,
  Loader2,
  Mail,
  Phone,
  Plus,
  Star,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import {
  BLOCK_META,
  newBlock,
  OPTION_TYPES,
  type Block,
  type BlockType,
  type FormSchema,
} from "@formbuilder/form-schema";
import {
  getForm,
  saveSchema,
  updateForm,
  type FormStatus,
} from "@/lib/api";

const ICONS: Record<BlockType, typeof Type> = {
  short: Type,
  long: AlignLeft,
  choice: CircleDot,
  checkbox: CheckSquare,
  dropdown: ChevronDown,
  number: Hash,
  email: Mail,
  phone: Phone,
  date: Calendar,
  rating: Star,
  file: Upload,
  payment: Hash,
  signature: Type,
  heading: Type,
};

const PALETTE: { group: string; types: BlockType[] }[] = [
  { group: "Text", types: ["short", "long", "email", "phone"] },
  { group: "Choice", types: ["choice", "checkbox", "dropdown"] },
  { group: "Other", types: ["number", "date", "rating", "file"] },
];

function BlockPreview({ block }: { block: Block }) {
  const box = "rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-faint";
  if (block.type === "long")
    return <div className={`${box} min-h-[64px]`}>Long answer…</div>;
  if (block.type === "date")
    return (
      <div className={`${box} flex items-center justify-between`}>
        <span>mm / dd / yyyy</span>
        <Calendar className="h-4 w-4" />
      </div>
    );
  if (block.type === "file")
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-line-2 py-5 text-sm text-muted">
        <Upload className="h-4 w-4" />
        Drag a file or browse
      </div>
    );
  if (block.type === "rating")
    return (
      <div className="flex gap-1.5 text-[#e2c14d]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="h-6 w-6" />
        ))}
      </div>
    );
  if (OPTION_TYPES.includes(block.type)) {
    const opts = block.options ?? [];
    if (block.type === "dropdown")
      return (
        <div className={`${box} flex items-center justify-between`}>
          <span>{opts[0] ?? "Choose…"}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      );
    return (
      <div className="flex flex-col gap-2">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm text-ink/80">
            <span
              className={`h-4 w-4 border border-line-2 ${block.type === "checkbox" ? "rounded" : "rounded-full"}`}
            />
            {o}
          </div>
        ))}
      </div>
    );
  }
  const ph =
    block.type === "email"
      ? "name@company.com"
      : block.type === "phone"
        ? "+1 (555) 000-0000"
        : block.type === "number"
          ? "0"
          : "Short answer…";
  return <div className={box}>{ph}</div>;
}

export default function EditorPage() {
  const params = useParams();
  const id = String(params.id);

  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<FormStatus>("DRAFT");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getForm(id)
      .then((f) => {
        const s = f.versions[0]?.schema;
        setSchema({
          title: s?.title || f.title,
          description: s?.description,
          blocks: s?.blocks ?? [],
        });
        setSlug(f.slug);
        setStatus(f.status);
        setSelectedId(s?.blocks?.[0]?.id ?? null);
        requestAnimationFrame(() => (loaded.current = true));
      })
      .catch(() => setSave("error"));
  }, [id]);

  // debounced autosave
  useEffect(() => {
    if (!loaded.current || !schema) return;
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await saveSchema(id, schema);
        setSave("saved");
      } catch {
        setSave("error");
      }
    }, 650);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schema, id]);

  const patch = (fn: (s: FormSchema) => FormSchema) =>
    setSchema((s) => (s ? fn(s) : s));

  const addBlock = (type: BlockType) => {
    const b = newBlock(type);
    patch((s) => ({ ...s, blocks: [...s.blocks, b] }));
    setSelectedId(b.id);
  };
  const updateBlock = (bid: string, p: Partial<Block>) =>
    patch((s) => ({
      ...s,
      blocks: s.blocks.map((b) => (b.id === bid ? { ...b, ...p } : b)),
    }));
  const removeBlock = (bid: string) => {
    patch((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== bid) }));
    setSelectedId(null);
  };
  const move = (bid: string, dir: -1 | 1) =>
    patch((s) => {
      const i = s.blocks.findIndex((b) => b.id === bid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.blocks.length) return s;
      const blocks = [...s.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...s, blocks };
    });

  async function publish() {
    if (!schema) return;
    setPublishing(true);
    try {
      await saveSchema(id, schema);
      await updateForm(id, { status: "PUBLISHED" });
      setStatus("PUBLISHED");
      setSave("saved");
    } catch {
      setSave("error");
    } finally {
      setPublishing(false);
    }
  }

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/r/${slug}` : `/r/${slug}`;

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!schema)
    return (
      <div className="grid h-screen place-items-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  const selected = schema.blocks.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col bg-bg">
      {/* Top bar */}
      <header className="flex h-14 flex-none items-center gap-3 border-b border-line bg-surface px-4">
        <Link
          href="/app"
          className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-2 hover:bg-surface-3"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <input
          value={schema.title}
          onChange={(e) => patch((s) => ({ ...s, title: e.target.value }))}
          className="min-w-0 max-w-[280px] flex-none rounded-md px-2 py-1 text-[15px] font-semibold tracking-tight outline-none hover:bg-surface-3 focus:bg-surface-3"
          spellCheck={false}
        />
        <span className="flex items-center gap-1.5 text-xs text-faint">
          {save === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {save === "saved" && <Check className="h-3.5 w-3.5 text-green" />}
          {save === "error" ? "Save failed" : save === "saving" ? "Saving…" : "Saved"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {status === "PUBLISHED" ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F6ED] px-2.5 py-1 text-xs font-semibold text-green">
                <span className="h-1.5 w-1.5 rounded-full bg-green" /> Published
              </span>
              <button onClick={copyLink} className="btn btn-outline btn-sm">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <a href={`/r/${slug}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                <ExternalLink className="h-4 w-4" /> View live
              </a>
            </>
          ) : (
            <button onClick={publish} disabled={publishing} className="btn btn-primary btn-sm">
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {publishing ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
      </header>

      {/* Body: palette | canvas | inspector */}
      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Palette */}
        <aside className="overflow-auto border-r border-line bg-surface p-3">
          {PALETTE.map((grp) => (
            <div key={grp.group}>
              <h4 className="px-2 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-faint">
                {grp.group}
              </h4>
              {grp.types.map((t) => {
                const Icon = ICONS[t];
                return (
                  <button
                    key={t}
                    onClick={() => addBlock(t)}
                    className="group flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-accent-weak hover:text-accent-2"
                  >
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-md bg-surface-3 text-muted group-hover:bg-surface group-hover:text-accent-2">
                      <Icon className="h-4 w-4" />
                    </span>
                    {BLOCK_META[t].label}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Canvas */}
        <div className="overflow-auto bg-bg px-6 py-8">
          <div className="mx-auto max-w-[640px]">
            <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
              <input
                value={schema.title}
                onChange={(e) => patch((s) => ({ ...s, title: e.target.value }))}
                className="w-full text-[26px] font-bold tracking-tight outline-none"
                spellCheck={false}
              />
              <input
                value={schema.description ?? ""}
                onChange={(e) => patch((s) => ({ ...s, description: e.target.value }))}
                placeholder="Add a description…"
                className="mt-1.5 w-full text-[14.5px] text-muted outline-none"
                spellCheck={false}
              />

              <div className="mt-6 flex flex-col gap-2.5">
                {schema.blocks.map((b, i) => {
                  const Icon = ICONS[b.type];
                  const sel = b.id === selectedId;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedId(b.id)}
                      className={`group relative cursor-pointer rounded-xl border p-3.5 transition-colors ${
                        sel
                          ? "border-accent bg-white ring-2 ring-accent-weak"
                          : "border-transparent hover:border-line-2 hover:bg-surface-2"
                      }`}
                    >
                      <div className="mb-2.5 flex items-center gap-2">
                        <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-md bg-accent-weak text-accent-2">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-semibold">{b.label}</span>
                        {b.required && <span className="text-red">*</span>}
                      </div>
                      <BlockPreview block={b} />

                      {/* row controls */}
                      <div className="absolute right-2.5 top-2.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            move(b.id, -1);
                          }}
                          disabled={i === 0}
                          className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            move(b.id, 1);
                          }}
                          disabled={i === schema.blocks.length - 1}
                          className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBlock(b.id);
                          }}
                          className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-[#FCECEC] hover:text-red"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {schema.blocks.length === 0 && (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-2 py-10 text-center">
                  <span className="text-sm font-medium text-ink">Add your first question</span>
                  <span className="text-sm text-muted">Pick a block from the left to get started.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inspector */}
        <aside className="overflow-auto border-l border-line bg-surface p-4">
          {selected ? (
            <div key={selected.id}>
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">
                Question
              </h4>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Label</label>
              <input
                value={selected.label}
                onChange={(e) => updateBlock(selected.id, { label: e.target.value })}
                className="mb-3 w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-weak"
              />
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Help text</label>
              <input
                value={selected.description ?? ""}
                onChange={(e) => updateBlock(selected.id, { description: e.target.value })}
                placeholder="Optional"
                className="mb-4 w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-weak"
              />

              {OPTION_TYPES.includes(selected.type) && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Options</label>
                  <div className="flex flex-col gap-2">
                    {(selected.options ?? []).map((o, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          value={o}
                          onChange={(e) => {
                            const options = [...(selected.options ?? [])];
                            options[i] = e.target.value;
                            updateBlock(selected.id, { options });
                          }}
                          className="w-full rounded-lg border border-line-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-weak"
                        />
                        <button
                          onClick={() => {
                            const options = (selected.options ?? []).filter((_, k) => k !== i);
                            updateBlock(selected.id, { options });
                          }}
                          className="grid h-8 w-8 flex-none place-items-center rounded-lg text-faint hover:bg-surface-3 hover:text-ink"
                          aria-label="Remove option"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        updateBlock(selected.id, {
                          options: [...(selected.options ?? []), `Option ${(selected.options?.length ?? 0) + 1}`],
                        })
                      }
                      className="flex items-center gap-1.5 text-sm font-medium text-accent-2 hover:underline"
                    >
                      <Plus className="h-4 w-4" /> Add option
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-line py-3 text-[13.5px]">
                <span>Required</span>
                <button
                  role="switch"
                  aria-checked={selected.required}
                  onClick={() => updateBlock(selected.id, { required: !selected.required })}
                  className={`relative h-5 w-9 rounded-full transition-colors ${selected.required ? "bg-accent" : "bg-line-2"}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-transform ${selected.required ? "translate-x-[18px]" : "translate-x-0.5"}`}
                  />
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-6 text-center text-sm text-muted">
              Select a question to edit it, or add one from the left.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
