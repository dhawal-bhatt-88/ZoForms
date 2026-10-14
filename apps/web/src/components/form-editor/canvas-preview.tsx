/*
 * The canvas preview: how each block, and each group box, looks on the
 * editor canvas. Shared by the editor and anything else that shows a form or
 * a group the way the canvas does.
 */
import {
  AlignLeft,
  AudioLines,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock,
  EyeOff,
  FileText,
  Film,
  Gauge,
  Globe,
  Grid3x3,
  Hash,
  Heading as HeadingIcon,
  Image as ImageIcon,
  Layers,
  Link2,
  ListChecks,
  ListOrdered,
  Mail,
  Minus,
  PenTool,
  Phone,
  ShieldCheck,
  Star,
  Table2,
  Tag,
  Type,
  Upload,
} from "lucide-react";
import {
  BLOCK_META,
  isGrid,
  isValidImageSource,
  OPTION_TYPES,
  type AnyBlockType,
  type Block,
  type GridBlock,
  type GridColumn,
  type GroupBlock,
} from "@formbuilder/form-schema";
import { audioPreviewText } from "@/lib/audio-preview";
import { videoPreviewText } from "@/lib/video-preview";

export const ICONS: Record<AnyBlockType, typeof Type> = {
  group: Layers,
  page: FileText,
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
  grid: Grid3x3,
  rating: Star,
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

export function BlockPreview({ block }: { block: Block }) {
  const box = "rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-faint";

  // ---- layout / static ----
  // These show what the renderer shows: a heading's label at its level; a title's
  // or label's content, falling back to the block's label.
  if (block.type === "divider") return <hr className="my-1 border-line-2" />;
  if (block.type === "heading") {
    const size = block.level === 1 ? "text-2xl" : block.level === 3 ? "text-base" : "text-lg";
    return <div className={`${size} font-bold tracking-tight text-ink`}>{block.label}</div>;
  }
  if (block.type === "text")
    // Line breaks kept, as the renderer shows them (contract §9).
    return <p className="whitespace-pre-line text-sm text-muted">{block.content?.trim() ? block.content : "Descriptive text…"}</p>;
  if (block.type === "title")
    return <div className="text-xl font-bold tracking-tight text-ink">{block.content || block.label}</div>;
  if (block.type === "label")
    return (
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
        {block.content || block.label}
      </div>
    );
  if (block.type === "image") {
    const src = (block.content ?? "").trim();
    if (!isValidImageSource(src))
      return (
        <div className={`${box} flex items-center gap-2`}>
          <ImageIcon className="h-4 w-4" /> Add an image address
        </div>
      );
    // A root-relative path lives on the client's server, not ours: don't try to load it.
    if (src.startsWith("/"))
      return (
        <div className={`${box} flex items-center gap-2`}>
          <ImageIcon className="h-4 w-4 flex-none" />
          <span className="min-w-0 truncate">Shown from the app&apos;s own server: {src}</span>
        </div>
      );
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" referrerPolicy="no-referrer" className="max-h-40 rounded-lg" />
    );
  }
  if (block.type === "video")
    // Names what the renderer will play (contract §10) without loading anything third-party.
    return (
      <div className={`${box} flex items-center gap-2`}>
        <Film className="h-4 w-4 flex-none" />
        <span className="min-w-0 truncate">{videoPreviewText(block.content)}</span>
      </div>
    );
  if (block.type === "audio")
    // Names the file the renderer will play (contract §11); nothing is loaded.
    return (
      <div className={`${box} flex items-center gap-2`}>
        <AudioLines className="h-4 w-4 flex-none" />
        <span className="min-w-0 truncate">{audioPreviewText(block.content)}</span>
      </div>
    );
  if (block.type === "embed")
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
  if (isGrid(block)) return <GridPreview block={block} />;
  if (block.type === "matrix") {
    const rows = block.options ?? [];
    const cols = block.columns ?? [];
    return (
      <div className="overflow-hidden rounded-lg border border-line text-xs">
        <div className="flex bg-surface-2">
          <div className="flex-[1.2] p-1.5" />
          {cols.map((c, i) => (
            <div key={i} className="flex-1 p-1.5 text-center font-medium text-muted">
              {c.label}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={ri} className="flex border-t border-line">
            <div className="flex-[1.2] p-1.5 text-ink-2">{r.label}</div>
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
          <span>{opts[0]?.label ?? "Choose…"}</span>
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
              {o.label}
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
            {o.label}
          </div>
        ))}
      </div>
    );
  }
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

/** A grid cell's input, as a disabled stand-in: what the renderer will show there (contract §14.5). */
function GridCellPreview({ column }: { column: GridColumn }) {
  if (column.type === "radio")
    return (
      <span className="flex flex-col gap-1">
        {(column.options ?? []).map((o, i) => (
          <span key={i} className="flex items-center gap-1.5 whitespace-nowrap text-muted">
            <span className="inline-block h-3 w-3 flex-none rounded-full border border-line-2" />
            {o.label}
          </span>
        ))}
      </span>
    );
  if (column.type === "dropdown")
    return (
      <span className="flex min-w-[96px] items-center justify-between gap-2 rounded-md border border-line-2 bg-surface px-2 py-1 text-faint">
        <span className="whitespace-nowrap">Choose…</span>
        <ChevronDown className="h-3.5 w-3.5 flex-none" />
      </span>
    );
  return <span className="block h-[26px] min-w-[96px] rounded-md border border-line-2 bg-surface" />;
}

/**
 * The canvas preview of a grid: the table the renderer shows in its wide
 * layout — column headers, row headers, and a stand-in input in every cell.
 * The card's header already shows the grid's label, so it isn't repeated. A
 * wide grid scrolls sideways inside the card. Labels are text, never markup.
 */
function GridPreview({ block }: { block: GridBlock }) {
  const rows = block.rows ?? [];
  const columns = block.columns ?? [];
  return (
    <div data-grid-preview className="max-w-full overflow-x-auto rounded-lg border border-line">
      <table className="min-w-full border-collapse text-xs">
        <thead className="bg-surface-2">
          <tr>
            <td className="p-2" />
            {columns.map((c, i) => (
              <th key={i} scope="col" className="whitespace-nowrap p-2 text-left align-bottom font-medium text-ink-2">
                {c.label}
                {c.required && <span className="text-red"> *</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-line">
              <th scope="row" className="whitespace-nowrap p-2 text-left align-top font-normal text-ink-2">
                {r.label}
              </th>
              {columns.map((c, ci) => (
                <td key={ci} className="p-2 align-top">
                  <GridCellPreview column={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Blocks nested deeper than this get no more indentation, and a "Level N" chip instead. */
export const MAX_INDENT_LEVELS = 6;

/** Where a dragged block will land: an accent line just above or below an element. */
export function DropLine({ at }: { at: "top" | "bottom" }) {
  return (
    <span
      aria-hidden="true"
      data-drop-line=""
      className="pointer-events-none absolute inset-x-0 z-20 h-[3px] rounded-full bg-accent"
      style={at === "top" ? { top: -7 } : { bottom: -7 }}
    />
  );
}

/**
 * A group on the canvas: a box holding its header card, its contents and the
 * "Add to" row. Nested boxes alternate background so adjacent levels stay
 * distinct; past MAX_INDENT_LEVELS they stop adding padding. `level` counts
 * from the page, so a group looks the same with or without pages.
 */
export function GroupBox({
  group,
  level: depth,
  selected,
  dropTarget,
  dimmed,
  dropLine,
  header,
  children,
}: {
  group: GroupBlock;
  level: number;
  selected: boolean;
  /** The box a dragged block will be dropped into. */
  dropTarget: boolean;
  /** This group is the one being dragged. */
  dimmed: boolean;
  dropLine?: "top" | "bottom";
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  // Only the deepest boxes stop padding: their contents are marked with the "Level N" chip instead.
  const capped = depth > MAX_INDENT_LEVELS;
  return (
    <div
      data-group-box={group.id}
      data-drop-target={dropTarget || undefined}
      className={`relative rounded-xl border transition-[border-color,box-shadow,background-color] ${
        capped ? "-mx-px px-0" : "px-2.5"
      } ${children ? (capped ? "pb-1.5" : "pb-2.5") : ""} ${dropTarget ? "bg-accent-weak" : depth % 2 === 0 ? "bg-surface-3" : "bg-surface"} ${
        dropTarget
          ? "border-accent ring-2 ring-accent/30"
          : selected
            ? "border-accent ring-2 ring-accent-weak"
            : "border-line-2"
      } ${dimmed ? "opacity-50" : ""}`}
    >
      {dropLine && <DropLine at={dropLine} />}
      {header}
      {children && <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}
