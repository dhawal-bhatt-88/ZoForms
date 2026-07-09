"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  ArrowUp,
  AudioLines,
  BarChart3,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  Clock,
  Code2,
  Copy,
  CreditCard,
  ExternalLink,
  EyeOff,
  Film,
  Gauge,
  Globe,
  GripVertical,
  Hash,
  Heading as HeadingIcon,
  Image as ImageIcon,
  Inbox,
  Link2,
  ListChecks,
  ListOrdered,
  Loader2,
  Mail,
  Minus,
  PenTool,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Table2,
  Tag,
  Trash2,
  Type,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  BLOCK_META,
  newBlock,
  OPTION_TYPES,
  resolveTheme,
  STATIC_TYPES,
  type Block,
  type BlockType,
  type FormSchema,
} from "@formbuilder/form-schema";
import { editForm, getForm, saveSchema, updateForm, type FormStatus } from "@/lib/api";

type AiMsg = { role: "user" | "assistant"; text: string; changes?: string[] };

const ICONS: Record<BlockType, typeof Type> = {
  short: Type,
  long: AlignLeft,
  choice: CircleDot,
  checkbox: CheckSquare,
  dropdown: ChevronDown,
  multiselect: ListChecks,
  number: Hash,
  email: Mail,
  phone: Phone,
  link: Link2,
  file: Upload,
  date: Calendar,
  time: Clock,
  scale: Gauge,
  matrix: Table2,
  rating: Star,
  payment: CreditCard,
  signature: PenTool,
  ranking: ListOrdered,
  heading: HeadingIcon,
  text: AlignLeft,
  divider: Minus,
  title: HeadingIcon,
  label: Tag,
  image: ImageIcon,
  video: Film,
  audio: AudioLines,
  embed: Globe,
  hidden: EyeOff,
  recaptcha: ShieldCheck,
  country: Globe,
};

type CatalogItem = {
  type: BlockType;
  label?: string;
  keywords?: string;
  level?: number;
  soon?: boolean;
};

/** The slash-menu catalog, grouped like Tally. */
const CATALOG: { group: string; items: CatalogItem[] }[] = [
  {
    group: "Questions",
    items: [
      { type: "short" },
      { type: "long" },
      { type: "choice", keywords: "multiple radio" },
      { type: "checkbox" },
      { type: "dropdown", keywords: "select" },
      { type: "multiselect", keywords: "tags multiple" },
      { type: "number" },
      { type: "email" },
      { type: "phone", keywords: "mobile" },
      { type: "link", keywords: "url website" },
      { type: "file", keywords: "upload attachment" },
      { type: "date" },
      { type: "time" },
      { type: "scale", keywords: "linear nps" },
      { type: "matrix", keywords: "grid table", soon: true },
      { type: "rating", keywords: "stars" },
      { type: "payment", keywords: "stripe pay", soon: true },
      { type: "signature", keywords: "sign", soon: true },
      { type: "ranking", keywords: "order rank" },
    ],
  },
  {
    group: "Layout",
    items: [
      { type: "text", keywords: "paragraph" },
      { type: "heading", label: "Heading 1", level: 1, keywords: "h1 title" },
      { type: "heading", label: "Heading 2", level: 2, keywords: "h2" },
      { type: "heading", label: "Heading 3", level: 3, keywords: "h3" },
      { type: "divider", keywords: "separator line hr" },
      { type: "title" },
      { type: "label" },
    ],
  },
  {
    group: "Embed",
    items: [
      { type: "image", keywords: "picture photo" },
      { type: "video", keywords: "youtube" },
      { type: "audio", keywords: "sound" },
      { type: "embed", keywords: "iframe anything" },
    ],
  },
  {
    group: "Advanced",
    items: [
      { type: "hidden", keywords: "hidden field prefill" },
      { type: "recaptcha", keywords: "spam captcha", soon: true },
      { type: "country", keywords: "geo location" },
    ],
  },
];

/** Notion-style slash / insert menu. Filters the catalog by a query string. */
function BlockMenu({
  query,
  onQuery,
  onPick,
  onClose,
  pos,
}: {
  query: string;
  onQuery: (q: string) => void;
  onPick: (item: CatalogItem) => void;
  onClose: () => void;
  pos: { left: number; top: number };
}) {
  const q = query.trim().toLowerCase();
  const groups = CATALOG.map((g) => ({
    group: g.group,
    items: g.items.filter((it) => {
      if (!q) return true;
      const label = (it.label || BLOCK_META[it.type].label).toLowerCase();
      return label.includes(q) || (it.keywords || "").includes(q) || it.type.includes(q);
    }),
  })).filter((g) => g.items.length > 0);

  const flat = groups.flatMap((g) => g.items);

  return (
    <div
      style={{ position: "fixed", left: pos.left, top: pos.top }}
      className="z-40 max-h-[420px] w-[320px] overflow-auto rounded-xl border border-line bg-surface p-1.5 shadow-pop"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="sticky top-0 -mx-1.5 -mt-1.5 mb-1 flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <Search className="h-4 w-4 text-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && flat[0]) {
              e.preventDefault();
              onPick(flat[0]);
            }
          }}
          placeholder="Search blocks…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>
      {groups.length === 0 && (
        <div className="px-3 py-4 text-center text-sm text-muted">No blocks match “{query}”.</div>
      )}
      {groups.map((g) => (
        <div key={g.group} className="mb-1">
          <div className="px-2 pb-0.5 pt-1.5 text-[10.5px] font-bold uppercase tracking-wider text-faint">
            {g.group}
          </div>
          {g.items.map((it, i) => {
            const Icon = ICONS[it.type];
            const label = it.label || BLOCK_META[it.type].label;
            return (
              <button
                key={it.type + i}
                onClick={() => onPick(it)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-ink-2 transition-colors hover:bg-accent-weak hover:text-accent-2"
              >
                <span className="grid h-7 w-7 flex-none place-items-center rounded-md bg-surface-3 text-muted">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">{label}</span>
                {it.soon && (
                  <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-faint">
                    basic
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ColorField({
  label,
  value,
  swatches,
  onPick,
}: {
  label: string;
  value: string;
  swatches: string[];
  onPick: (c: string) => void;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</label>
      <div className="flex items-center gap-1.5">
        {swatches.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            className="h-6 w-6 rounded-md border-2 transition-transform hover:scale-110"
            style={{
              background: c,
              borderColor:
                value.toLowerCase() === c.toLowerCase() ? "#1B1D22" : "rgba(0,0,0,0.08)",
            }}
            aria-label={`${label} ${c}`}
          />
        ))}
        <label
          className="relative ml-auto h-6 w-9 cursor-pointer overflow-hidden rounded-md border border-line-2"
          style={{ background: value }}
          title="Custom color"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onPick(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: Block }) {
  const box = "rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-faint";

  // ---- layout / static ----
  if (block.type === "divider") return <hr className="my-1 border-line-2" />;
  if (block.type === "text")
    return <p className="text-sm text-muted">{block.content || "Descriptive text…"}</p>;
  if (block.type === "title")
    return <div className="text-xl font-bold tracking-tight text-ink">{block.content || "Title"}</div>;
  if (block.type === "label")
    return (
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
        {block.content || "Label"}
      </div>
    );
  if (block.type === "image")
    return block.content ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={block.content} alt="" className="max-h-40 rounded-lg" />
    ) : (
      <div className={`${box} flex items-center gap-2`}>
        <ImageIcon className="h-4 w-4" /> Add an image URL…
      </div>
    );
  if (block.type === "video" || block.type === "audio" || block.type === "embed")
    return (
      <div className={`${box} flex items-center gap-2`}>
        {BLOCK_META[block.type].label} · {block.content || "paste a URL"}
      </div>
    );
  if (block.type === "hidden")
    return <div className={box}>Hidden field — not shown to respondents</div>;
  if (block.type === "recaptcha")
    return (
      <div className={`${box} flex items-center gap-2`}>
        <ShieldCheck className="h-4 w-4" /> reCAPTCHA badge (added on publish)
      </div>
    );
  if (block.type === "country")
    return (
      <div className={`${box} flex items-center justify-between`}>
        <span>Auto-detected country</span>
        <Globe className="h-4 w-4" />
      </div>
    );

  // ---- inputs ----
  if (block.type === "long") return <div className={`${box} min-h-[64px]`}>Long answer…</div>;
  if (block.type === "date")
    return (
      <div className={`${box} flex items-center justify-between`}>
        <span>mm / dd / yyyy</span>
        <Calendar className="h-4 w-4" />
      </div>
    );
  if (block.type === "time")
    return (
      <div className={`${box} flex items-center justify-between`}>
        <span>--:--</span>
        <Clock className="h-4 w-4" />
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
  if (block.type === "scale") {
    const min = block.min ?? 1;
    const max = block.max ?? 5;
    const arr: number[] = [];
    for (let n = min; n <= max && arr.length < 12; n++) arr.push(n);
    return (
      <div className="flex flex-wrap gap-1.5">
        {arr.map((n) => (
          <span
            key={n}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line-2 text-sm text-muted"
          >
            {n}
          </span>
        ))}
      </div>
    );
  }
  if (block.type === "matrix") {
    const rows = block.options ?? [];
    const cols = block.columns ?? [];
    return (
      <div className="overflow-hidden rounded-lg border border-line text-xs">
        <div className="flex bg-surface-2">
          <div className="flex-[1.2] p-1.5" />
          {cols.map((c, i) => (
            <div key={i} className="flex-1 p-1.5 text-center font-medium text-muted">
              {c}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={ri} className="flex border-t border-line">
            <div className="flex-[1.2] p-1.5 text-ink-2">{r}</div>
            {cols.map((_, ci) => (
              <div key={ci} className="flex-1 p-1.5 text-center">
                <span className="inline-block h-3.5 w-3.5 rounded-full border border-line-2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (OPTION_TYPES.includes(block.type)) {
    const opts = block.options ?? [];
    if (block.type === "dropdown")
      return (
        <div className={`${box} flex items-center justify-between`}>
          <span>{opts[0] ?? "Choose…"}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      );
    if (block.type === "ranking")
      return (
        <div className="flex flex-col gap-2">
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-ink/80">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-surface-3 text-xs font-semibold text-muted">
                {i + 1}
              </span>
              {o}
            </div>
          ))}
        </div>
      );
    const square = block.type === "checkbox" || block.type === "multiselect";
    return (
      <div className="flex flex-col gap-2">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm text-ink/80">
            <span className={`h-4 w-4 border border-line-2 ${square ? "rounded" : "rounded-full"}`} />
            {o}
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "payment")
    return (
      <div className={`${box} flex items-center gap-2`}>
        <CreditCard className="h-4 w-4" /> Card payment (connect Stripe)
      </div>
    );
  if (block.type === "signature")
    return (
      <div className="rounded-lg border border-dashed border-line-2 py-6 text-center text-sm text-muted">
        Sign here
      </div>
    );
  const ph =
    block.type === "email"
      ? "name@company.com"
      : block.type === "phone"
        ? "+1 (555) 000-0000"
        : block.type === "number"
          ? "0"
          : block.type === "link"
            ? "https://…"
            : "Short answer…";
  return <div className={box}>{ph}</div>;
}

function SortableBlock({
  block,
  selected,
  onSelect,
  onDelete,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const Icon = ICONS[block.type];
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative cursor-pointer rounded-xl border p-3.5 transition-colors ${
        selected
          ? "border-accent bg-white ring-2 ring-accent-weak"
          : "border-transparent hover:border-line-2 hover:bg-surface-2"
      } ${isDragging ? "z-10 opacity-70 shadow-pop" : ""}`}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab text-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-md bg-accent-weak text-accent-2">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="font-semibold">{block.label}</span>
        {block.required && <span className="text-red">*</span>}
      </div>
      <BlockPreview block={block} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-md text-faint opacity-0 transition-opacity hover:bg-[#FCECEC] hover:text-red group-hover:opacity-100"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
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
  const [embedOpen, setEmbedOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState<AiMsg[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [menuAnchor, setMenuAnchor] = useState({ left: 0, top: 0 });
  const insertRowRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    getForm(id)
      .then((f) => {
        const s = f.versions[0]?.schema;
        setSchema({
          title: s?.title || f.title,
          description: s?.description,
          settings: s?.settings,
          blocks: s?.blocks ?? [],
        });
        setSlug(f.slug);
        setStatus(f.status);
        setSelectedId(s?.blocks?.[0]?.id ?? null);
        requestAnimationFrame(() => (loaded.current = true));
      })
      .catch(() => setSave("error"));
  }, [id]);

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

  const openMenu = () => {
    const r = insertRowRef.current?.getBoundingClientRect();
    if (r) {
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      const top = r.bottom + 6 + 430 > vh ? Math.max(8, r.top - 430) : r.bottom + 6;
      const left = Math.max(8, Math.min(r.left, vw - 336));
      setMenuAnchor({ left, top });
    }
    setMenuQuery("");
    setMenuOpen(true);
  };

  const insertFromCatalog = (item: CatalogItem) => {
    const b = newBlock(item.type, item.level ? { level: item.level } : undefined);
    patch((s) => {
      const idx = selectedId ? s.blocks.findIndex((x) => x.id === selectedId) : -1;
      const at = idx >= 0 ? idx + 1 : s.blocks.length;
      const blocks = [...s.blocks];
      blocks.splice(at, 0, b);
      return { ...s, blocks };
    });
    setSelectedId(b.id);
    setMenuOpen(false);
    setMenuQuery("");
  };
  const updateBlock = (bid: string, p: Partial<Block>) =>
    patch((s) => ({
      ...s,
      blocks: s.blocks.map((b) => (b.id === bid ? { ...b, ...p } : b)),
    }));
  const removeBlock = (bid: string) => {
    patch((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== bid) }));
    setSelectedId((cur) => (cur === bid ? null : cur));
  };
  const updateSettings = (p: { submitLabel?: string; redirectUrl?: string }) =>
    patch((s) => ({ ...s, settings: { ...s.settings, ...p } }));
  const updateTheme = (p: {
    accent?: string;
    background?: string;
    text?: string;
    buttonText?: string;
    font?: "sans" | "serif" | "mono" | "rounded";
    radius?: "none" | "sm" | "md" | "lg" | "full";
    width?: "narrow" | "normal" | "wide";
    logo?: string;
    cover?: string;
    inputBg?: string;
    inputBorder?: string;
    customCss?: string;
  }) =>
    patch((s) => ({
      ...s,
      settings: { ...s.settings, theme: { ...s.settings?.theme, ...p } },
    }));

  async function onAiSend() {
    const text = aiInput.trim();
    if (!text || aiBusy || !schema) return;
    setAiMsgs((m) => [...m, { role: "user", text }]);
    setAiInput("");
    setAiBusy(true);
    try {
      const res = await editForm(schema, text);
      setSchema(res.schema);
      setSelectedId(null);
      setAiMsgs((m) => [
        ...m,
        { role: "assistant", text: res.message, changes: res.changes },
      ]);
    } catch (e) {
      setAiMsgs((m) => [
        ...m,
        { role: "assistant", text: (e as Error).message || "Something went wrong." },
      ]);
    } finally {
      setAiBusy(false);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    patch((s) => {
      const oldIndex = s.blocks.findIndex((b) => b.id === active.id);
      const newIndex = s.blocks.findIndex((b) => b.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return s;
      return { ...s, blocks: arrayMove(s.blocks, oldIndex, newIndex) };
    });
  }

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
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  function copySnippet(key: string, text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }
  const embeds = [
    {
      key: "inline",
      label: "Inline (auto-resizes)",
      code: `<script src="${origin}/embed.js"></script>\n<div data-frame-form="${slug}"></div>`,
    },
    {
      key: "popup",
      label: "Popup button",
      code: `<script src="${origin}/embed.js"></script>\n<button data-frame-popup="${slug}">Open form</button>`,
    },
    { key: "full", label: "Full-page link", code: `${origin}/r/${slug}` },
  ];

  if (!schema)
    return (
      <div className="grid h-screen place-items-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  const selected = schema.blocks.find((b) => b.id === selectedId) ?? null;
  const fieldCls =
    "w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-weak";

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
          <Link href={`/app/forms/${id}/responses`} className="btn btn-ghost btn-sm">
            <Inbox className="h-4 w-4" /> Responses
          </Link>
          <Link href={`/app/forms/${id}/analytics`} className="btn btn-ghost btn-sm">
            <BarChart3 className="h-4 w-4" /> Analytics
          </Link>
          <Link href={`/app/forms/${id}/integrations`} className="btn btn-ghost btn-sm">
            <Zap className="h-4 w-4" /> Connect
          </Link>
          <button
            onClick={() => setAiOpen((v) => !v)}
            className={`btn btn-sm ${aiOpen ? "btn-primary" : "btn-outline"}`}
          >
            <Sparkles className="h-4 w-4" /> Ask AI
          </button>
          {status === "PUBLISHED" ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F6ED] px-2.5 py-1 text-xs font-semibold text-green">
                <span className="h-1.5 w-1.5 rounded-full bg-green" /> Published
              </span>
              <button onClick={copyLink} className="btn btn-outline btn-sm">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <button onClick={() => setEmbedOpen(true)} className="btn btn-outline btn-sm">
                <Code2 className="h-4 w-4" /> Embed
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

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px]">
        {/* Canvas */}
        <div className="overflow-auto bg-bg px-6 py-8">
          <div className="mx-auto max-w-[680px]">
            <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
              <input
                value={schema.title}
                onChange={(e) => patch((s) => ({ ...s, title: e.target.value }))}
                onFocus={() => setSelectedId(null)}
                className="w-full text-[26px] font-bold tracking-tight outline-none"
                spellCheck={false}
              />
              <input
                value={schema.description ?? ""}
                onChange={(e) => patch((s) => ({ ...s, description: e.target.value }))}
                onFocus={() => setSelectedId(null)}
                placeholder="Add a description…"
                className="mt-1.5 w-full text-[14.5px] text-muted outline-none"
                spellCheck={false}
              />

              <div className="mt-6">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext
                    items={schema.blocks.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2.5">
                      {schema.blocks.map((b) => (
                        <SortableBlock
                          key={b.id}
                          block={b}
                          selected={b.id === selectedId}
                          onSelect={() => setSelectedId(b.id)}
                          onDelete={() => removeBlock(b.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              {/* Notion-style slash inserter */}
              <div ref={insertRowRef} className="mt-3 flex items-center gap-2 rounded-lg px-1 py-1">
                <button
                  onClick={openMenu}
                  className="grid h-7 w-7 flex-none place-items-center rounded-md border border-line-2 text-muted transition-colors hover:bg-surface-3 hover:text-ink"
                  title="Insert a block"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <input
                  value=""
                  onChange={() => {}}
                  onKeyDown={(e) => {
                    if (e.key === "/") {
                      e.preventDefault();
                      openMenu();
                    }
                  }}
                  placeholder="Type / to insert a block, or click +"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
                  spellCheck={false}
                />
              </div>

              {schema.blocks.length === 0 && (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-2 py-10 text-center">
                  <span className="text-sm font-medium text-ink">Add your first block</span>
                  <span className="text-sm text-muted">
                    Type <kbd className="rounded border border-line-2 bg-surface-2 px-1.5 font-mono text-xs">/</kbd>{" "}
                    above or click + to choose from {CATALOG.reduce((n, g) => n + g.items.length, 0)} block types.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => {
                setMenuOpen(false);
                setMenuQuery("");
              }}
            />
            <BlockMenu
              query={menuQuery}
              onQuery={setMenuQuery}
              onPick={insertFromCatalog}
              onClose={() => {
                setMenuOpen(false);
                setMenuQuery("");
              }}
              pos={menuAnchor}
            />
          </>
        )}

        {/* Inspector */}
        <aside className="overflow-auto border-l border-line bg-surface p-4">
          {selected ? (
            <div key={selected.id}>
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">Question</h4>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Label</label>
              <input
                value={selected.label}
                onChange={(e) => updateBlock(selected.id, { label: e.target.value })}
                className={`${fieldCls} mb-3`}
              />
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Help text</label>
              <input
                value={selected.description ?? ""}
                onChange={(e) => updateBlock(selected.id, { description: e.target.value })}
                placeholder="Optional"
                className={`${fieldCls} mb-4`}
              />

              {["text", "title", "label"].includes(selected.type) && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Content</label>
                  <textarea
                    value={selected.content ?? ""}
                    onChange={(e) => updateBlock(selected.id, { content: e.target.value })}
                    rows={selected.type === "text" ? 3 : 1}
                    className={`${fieldCls} resize-none`}
                  />
                </div>
              )}

              {["image", "video", "audio", "embed"].includes(selected.type) && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">URL</label>
                  <input
                    value={selected.content ?? ""}
                    onChange={(e) => updateBlock(selected.id, { content: e.target.value })}
                    placeholder="https://…"
                    className={`${fieldCls} font-mono text-xs`}
                  />
                </div>
              )}

              {selected.type === "heading" && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Level</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((l) => (
                      <button
                        key={l}
                        onClick={() => updateBlock(selected.id, { level: l })}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                          (selected.level || 2) === l
                            ? "border-accent bg-accent-weak text-accent-2"
                            : "border-line-2 text-muted"
                        }`}
                      >
                        H{l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selected.type === "scale" && (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Min</label>
                    <input
                      type="number"
                      value={selected.min ?? 1}
                      onChange={(e) => updateBlock(selected.id, { min: Number(e.target.value) })}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Max</label>
                    <input
                      type="number"
                      value={selected.max ?? 5}
                      onChange={(e) => updateBlock(selected.id, { max: Number(e.target.value) })}
                      className={fieldCls}
                    />
                  </div>
                </div>
              )}

              {OPTION_TYPES.includes(selected.type) && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                    {selected.type === "matrix" ? "Rows" : "Options"}
                  </label>
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
                          onClick={() =>
                            updateBlock(selected.id, {
                              options: (selected.options ?? []).filter((_, k) => k !== i),
                            })
                          }
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
                          options: [
                            ...(selected.options ?? []),
                            `Option ${(selected.options?.length ?? 0) + 1}`,
                          ],
                        })
                      }
                      className="flex items-center gap-1.5 text-sm font-medium text-accent-2 hover:underline"
                    >
                      <Plus className="h-4 w-4" /> Add option
                    </button>
                  </div>
                </div>
              )}

              {!STATIC_TYPES.includes(selected.type) && (
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
              )}
            </div>
          ) : (
            <div>
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">Form settings</h4>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Submit button label</label>
              <input
                value={schema.settings?.submitLabel ?? ""}
                onChange={(e) => updateSettings({ submitLabel: e.target.value })}
                placeholder="Submit"
                className={`${fieldCls} mb-3`}
              />
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Redirect URL after submit</label>
              <input
                value={schema.settings?.redirectUrl ?? ""}
                onChange={(e) => updateSettings({ redirectUrl: e.target.value })}
                placeholder="https://…"
                className={fieldCls}
              />
              <p className="mt-1.5 text-xs text-muted">
                Leave blank to show the built-in thank-you screen.
              </p>

              <h4 className="mb-3 mt-6 border-t border-line pt-4 text-[11px] font-bold uppercase tracking-wider text-faint">
                Design
              </h4>

              <ColorField
                label="Accent"
                value={schema.settings?.theme?.accent || "#6D5EFA"}
                swatches={["#6D5EFA", "#2F6BE4", "#159C56", "#E1663E", "#D93F87", "#18181B"]}
                onPick={(c) => updateTheme({ accent: c })}
              />
              <ColorField
                label="Background"
                value={schema.settings?.theme?.background || "#F6F7F9"}
                swatches={["#FFFFFF", "#F6F7F9", "#FAF7F2", "#F2F4FF", "#111318"]}
                onPick={(c) => updateTheme({ background: c })}
              />
              <ColorField
                label="Text"
                value={schema.settings?.theme?.text || "#1B1D22"}
                swatches={["#1B1D22", "#37352F", "#0F172A", "#FFFFFF"]}
                onPick={(c) => updateTheme({ text: c })}
              />
              <ColorField
                label="Button text"
                value={schema.settings?.theme?.buttonText || "#FFFFFF"}
                swatches={["#FFFFFF", "#111318"]}
                onPick={(c) => updateTheme({ buttonText: c })}
              />

              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Font</label>
              <select
                value={schema.settings?.theme?.font ?? "sans"}
                onChange={(e) =>
                  updateTheme({ font: e.target.value as "sans" | "serif" | "mono" | "rounded" })
                }
                className={`${fieldCls} mb-3`}
              >
                <option value="sans">Sans</option>
                <option value="serif">Serif</option>
                <option value="mono">Mono</option>
                <option value="rounded">Rounded</option>
              </select>

              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Corners</label>
              <div className="mb-3 grid grid-cols-5 gap-1.5">
                {(["none", "sm", "md", "lg", "full"] as const).map((r) => {
                  const px = { none: "0px", sm: "3px", md: "6px", lg: "9px", full: "9999px" }[r];
                  const active = (schema.settings?.theme?.radius || "md") === r;
                  return (
                    <button
                      key={r}
                      onClick={() => updateTheme({ radius: r })}
                      title={r === "none" ? "Square" : r === "full" ? "Pill" : r}
                      className={`flex h-9 items-center justify-center rounded-lg border ${
                        active ? "border-accent bg-accent-weak" : "border-line-2"
                      }`}
                    >
                      <span
                        className="h-4 w-4 border-2"
                        style={{
                          borderTopLeftRadius: px,
                          borderColor: active ? "#6D5EFA" : "#9AA0AA",
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Width</label>
              <div className="mb-4 flex gap-1.5">
                {(["narrow", "normal", "wide"] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => updateTheme({ width: w })}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize ${
                      (schema.settings?.theme?.width || "normal") === w
                        ? "border-accent bg-accent-weak text-accent-2"
                        : "border-line-2 text-muted"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>

              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Live preview</label>
              {(() => {
                const th = resolveTheme(schema.settings?.theme);
                return (
                  <div
                    className="border border-line p-3"
                    style={{
                      background: th.background,
                      borderRadius: th.radius === "9999px" ? "20px" : th.radius,
                      fontFamily: th.fontFamily,
                      color: th.text,
                    }}
                  >
                    <div
                      className="border border-line bg-white p-3"
                      style={{ borderRadius: th.radius === "9999px" ? "16px" : th.radius }}
                    >
                      <div className="mb-2 text-sm font-bold">{schema.title || "Sample form"}</div>
                      <div
                        className="mb-2 border border-line-2 px-2 py-1.5 text-xs text-faint"
                        style={{ borderRadius: th.radius }}
                      >
                        Your answer…
                      </div>
                      <button
                        className="w-full py-1.5 text-xs font-semibold"
                        style={{ background: th.accent, color: th.buttonText, borderRadius: th.radius }}
                      >
                        {schema.settings?.submitLabel || "Submit"}
                      </button>
                    </div>
                  </div>
                );
              })()}

              <h4 className="mb-3 mt-6 border-t border-line pt-4 text-[11px] font-bold uppercase tracking-wider text-faint">
                Advanced
              </h4>

              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Logo URL</label>
              <input
                value={schema.settings?.theme?.logo ?? ""}
                onChange={(e) => updateTheme({ logo: e.target.value })}
                placeholder="https://…/logo.png"
                className={`${fieldCls} mb-3 font-mono text-xs`}
              />

              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Cover image URL</label>
              <input
                value={schema.settings?.theme?.cover ?? ""}
                onChange={(e) => updateTheme({ cover: e.target.value })}
                placeholder="https://…/cover.jpg"
                className={`${fieldCls} mb-3 font-mono text-xs`}
              />

              <ColorField
                label="Input background"
                value={schema.settings?.theme?.inputBg || "#FFFFFF"}
                swatches={["#FFFFFF", "#F6F7F9", "#F2F4FF", "#1C1F26"]}
                onPick={(c) => updateTheme({ inputBg: c })}
              />
              <ColorField
                label="Input border"
                value={schema.settings?.theme?.inputBorder || "#ECEDF0"}
                swatches={["#ECEDF0", "#D1D5DB", "#6D5EFA", "#333844"]}
                onPick={(c) => updateTheme({ inputBorder: c })}
              />

              <label className="mb-1.5 mt-1 block text-[12.5px] font-semibold text-ink-2">Custom CSS</label>
              <textarea
                value={schema.settings?.theme?.customCss ?? ""}
                onChange={(e) => updateTheme({ customCss: e.target.value })}
                placeholder={".frame-form h1 { letter-spacing: -0.02em; }"}
                rows={4}
                className={`${fieldCls} resize-none font-mono text-xs`}
                spellCheck={false}
              />
              <p className="mt-1.5 text-xs text-faint">
                Scoped tip: target <code className="font-mono">.frame-form</code> to style the form.
              </p>

              <p className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
                Select a question to edit it, or add one from the canvas.
              </p>
            </div>
          )}
        </aside>
      </div>

      {aiOpen && (
        <div className="fixed bottom-0 right-0 top-14 z-40 flex w-[360px] flex-col border-l border-line bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EFEDFE] text-accent-2">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold tracking-tight">Ask AI</div>
              <div className="text-[11px] text-faint">Describe a change and I&apos;ll edit the form</div>
            </div>
            <button
              onClick={() => setAiOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-auto px-4 py-4">
            {aiMsgs.length === 0 && (
              <div className="rounded-xl bg-surface-2 p-4 text-sm">
                <p className="mb-2 font-medium text-ink">Tell me what to change.</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Add a phone number field",
                    "Make everything required",
                    "Add 3 rating questions",
                    "Remove the company field",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setAiInput(s)}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 hover:border-line-2"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {aiMsgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === "user" ? "bg-primary text-white" : "bg-surface-2 text-ink"
                  }`}
                >
                  <div>{m.text}</div>
                  {m.changes && m.changes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {m.changes.map((c, j) => (
                        <li key={j} className="flex items-center gap-1.5 text-xs text-muted">
                          <Check className="h-3.5 w-3.5 flex-none text-green" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {aiBusy && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <div className="border-t border-line p-3">
            <div className="relative">
              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onAiSend();
                  }
                }}
                rows={2}
                placeholder="Ask AI to edit your form…"
                className="w-full resize-none rounded-xl border border-line-2 px-3 py-2.5 pr-11 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-weak"
              />
              <button
                onClick={onAiSend}
                disabled={aiBusy || !aiInput.trim()}
                className="absolute bottom-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-lg bg-primary text-white disabled:opacity-40"
                aria-label="Send"
              >
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {embedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEmbedOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">Embed this form</h3>
              <button
                onClick={() => setEmbedOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted">Paste into any site, CMS, or docs page.</p>
            {embeds.map((s) => (
              <div key={s.key} className="mb-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-ink-2">{s.label}</span>
                  <button
                    onClick={() => copySnippet(s.key, s.code)}
                    className="text-xs font-semibold text-accent-2 hover:underline"
                  >
                    {copiedKey === s.key ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-[#17161c] p-3 text-[12px] leading-relaxed text-[#e7e5ee]">
                  {s.code}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
