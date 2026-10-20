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
  Phone,
  Star,
  Table2,
  Tag,
  Type,
} from "lucide-react";
import {
  blockName,
  isGrid,
  isGroup,
  isPage,
  isRepeatingGroup,
  isValidImageSource,
  OPTION_TYPES,
  questionNumbers,
  type AnyBlockType,
  type Block,
  type GridBlock,
  type GridColumn,
  type GroupBlock,
} from "@formbuilder/form-schema";
import { cn } from "@formbuilder/ui";
import { StatusChip } from "@/components/ui";
import { audioPreviewText } from "@/lib/audio-preview";
import { videoPreviewText } from "@/lib/video-preview";
import { repeatBadgeText } from "@/lib/repeat-settings";

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
  date: Calendar,
  time: Clock,
  scale: Gauge,
  matrix: Table2,
  grid: Grid3x3,
  rating: Star,
  ranking: ListOrdered,
  heading: HeadingIcon,
  text: AlignLeft,
  divider: Minus,
  title: HeadingIcon,
  label: Tag,
  image: ImageIcon,
  video: Film,
  audio: AudioLines,
  hidden: EyeOff,
  country: Globe,
};

export function BlockPreview({ block }: { block: Block }) {
  const box = "rounded-lg border border-field-border bg-surface px-3 py-2.5 text-sm text-graphite-soft";

  // ---- layout / static ----
  // These show what the renderer shows: a heading's label at its level; a title's
  // or label's content, falling back to the block's label.
  if (block.type === "divider") return <hr className="my-1 border-rule-strong" />;
  if (block.type === "heading") {
    const size = block.level === 1 ? "text-2xl" : block.level === 3 ? "text-base" : "text-lg";
    return <div className={`${size} font-bold tracking-tight text-ink`}>{block.label}</div>;
  }
  if (block.type === "text")
    // Line breaks kept, as the renderer shows them (contract §9).
    return <p className="whitespace-pre-line text-sm text-graphite">{block.content?.trim() ? block.content : "Descriptive text…"}</p>;
  if (block.type === "title")
    return <div className="text-xl font-bold tracking-tight text-ink">{block.content || block.label}</div>;
  if (block.type === "label")
    return (
      <div className="text-[11px] font-bold uppercase tracking-wider text-graphite">
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
  if (block.type === "hidden")
    return <div className={box}>Hidden field — not shown to respondents</div>;
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
  if (block.type === "rating")
    return (
      <div className="flex gap-1.5 text-warn">
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
            className="grid h-8 w-8 place-items-center rounded-lg border border-field-border text-sm text-graphite"
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
      <div className="overflow-hidden rounded-lg border border-rule text-xs">
        <div className="flex bg-paper-sunk">
          <div className="flex-[1.2] p-1.5" />
          {cols.map((c, i) => (
            <div key={i} className="flex-1 p-1.5 text-center font-medium text-graphite">
              {c.label}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={ri} className="flex border-t border-rule">
            <div className="flex-[1.2] p-1.5 text-graphite">{r.label}</div>
            {cols.map((_, ci) => (
              <div key={ci} className="flex-1 p-1.5 text-center">
                <span className="inline-block h-3.5 w-3.5 rounded-full border border-field-border" />
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
            <div key={i} className="flex items-center gap-2.5 text-sm text-ink">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-paper-sunk text-xs font-semibold text-graphite">
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
          <div key={i} className="flex items-center gap-2.5 text-sm text-ink">
            <span className={`h-4 w-4 border border-field-border ${square ? "rounded" : "rounded-full"}`} />
            {o.label}
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
          <span key={i} className="flex items-center gap-1.5 whitespace-nowrap text-graphite">
            <span className="inline-block h-3 w-3 flex-none rounded-full border border-field-border" />
            {o.label}
          </span>
        ))}
      </span>
    );
  if (column.type === "dropdown")
    return (
      <span className="flex min-w-[96px] items-center justify-between gap-2 rounded-md border border-field-border bg-surface px-2 py-1 text-graphite-soft">
        <span className="whitespace-nowrap">Choose…</span>
        <ChevronDown className="h-3.5 w-3.5 flex-none" />
      </span>
    );
  return <span className="block h-[26px] min-w-[96px] rounded-md border border-field-border bg-surface" />;
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
    <div data-grid-preview className="max-w-full overflow-x-auto rounded-lg border border-rule">
      <table className="min-w-full border-collapse text-xs">
        <thead className="bg-paper-sunk">
          <tr>
            <td className="p-2" />
            {columns.map((c, i) => (
              <th key={i} scope="col" className="whitespace-nowrap p-2 text-left align-bottom font-medium text-graphite">
                {c.label}
                {c.required && (
                  <>
                    {" "}
                    <RequiredMark />
                  </>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-rule">
              <th scope="row" className="whitespace-nowrap p-2 text-left align-top font-normal text-graphite">
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
      className="pointer-events-none absolute inset-x-0 z-20 h-[3px] rounded-full bg-brand-deep"
      style={at === "top" ? { top: -7 } : { bottom: -7 }}
    />
  );
}

/**
 * A group on the canvas: a box holding its header card, its contents and the
 * "Add to" row. Nested boxes alternate between the `nest` fill and `surface`,
 * about 1.12:1 apart in both themes (globals.css); indentation and the header
 * carry the nesting too, and every box has its rule. Past MAX_INDENT_LEVELS
 * they stop adding padding. `level` counts from the page, so a group looks the
 * same with or without pages. Selected or a drop target: the accent border.
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
      className={cn(
        "relative rounded-[0.75rem] border transition-[border-color,box-shadow,background-color] duration-200 ease-out-expo",
        capped ? "-mx-px px-0" : "px-2.5",
        children && (capped ? "pb-1.5" : "pb-2.5"),
        dropTarget ? "bg-accent-wash" : depth % 2 === 0 ? "bg-nest" : "bg-surface",
        dropTarget || selected ? "border-brand-deep ring-[3px] ring-brand/20" : "border-rule-strong",
        dimmed && "opacity-50",
      )}
    >
      {dropLine && <DropLine at={dropLine} />}
      {header}
      {children && <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}

/** A block's type, as a glyph in the accent wash. Decorative: the name says what it is. */
export function BlockIcon({ type }: { type: AnyBlockType }) {
  const Icon = ICONS[type];
  return (
    <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-md bg-accent-wash text-brand-deep">
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * The required asterisk, kept because it previews what respondents see, but
 * graphite, not red (red only ever means critical), and read as "required",
 * not "star".
 */
export function RequiredMark() {
  return (
    <span data-required-mark className="flex-none text-graphite">
      <span aria-hidden="true">*</span>
      <span className="sr-only">required</span>
    </span>
  );
}

/** The chips after a block's name: a repeating group's entries, "Conditional", and a level past the indent limit. */
export function BlockChips({ block, level }: { block: Block; level?: number }) {
  return (
    <>
      {isGroup(block) && isRepeatingGroup(block) && (
        <span data-repeat-badge className="flex-none">
          <StatusChip>{repeatBadgeText(block)}</StatusChip>
        </span>
      )}
      {!!block.enableWhen?.length && (
        <StatusChip tone="accent" className="flex-none">
          Conditional
        </StatusChip>
      )}
      {level !== undefined && level > MAX_INDENT_LEVELS && <StatusChip className="flex-none">Level {level + 1}</StatusChip>}
    </>
  );
}

/** A page's number in its header bar, as an eyebrow: "PAGE 2". */
export function PageLabel({ number }: { number: number }) {
  // `uppercase` as well as the eyebrow's own: the e2e suites read the page label by it.
  return <span className="eyebrow flex-none uppercase text-graphite">Page {number}</span>;
}

/** The page box's frame and its header bar, shared with the read-only canvas. */
export const PAGE_BOX = "relative rounded-[0.875rem] border-2 bg-surface transition-[border-color,box-shadow] duration-200 ease-out-expo";
export const PAGE_HEADER = "flex items-center gap-2 px-3 py-2";

/* ---------- a read-only canvas ---------- */

/** A block's header line as the canvas shows it: icon, number, name and chips. No controls. */
function StaticHeader({ block, number }: { block: Block; number?: number }) {
  const unlabelled = isGroup(block) && !block.label.trim();
  return (
    <div className="flex items-center gap-2">
      <BlockIcon type={block.type} />
      {number !== undefined && <span className="flex-none text-[0.8125rem] font-semibold tabular-nums text-graphite">{number}.</span>}
      <span className={cn("min-w-0 truncate font-semibold", unlabelled && "italic text-graphite-soft")}>
        {unlabelled ? "Unlabelled group" : blockName(block)}
      </span>
      {(block.required || block.completeRequired) && <RequiredMark />}
      <BlockChips block={block} />
    </div>
  );
}

/**
 * `blocks` as the editor's canvas shows them — pages, group boxes, question
 * cards with their previews and numbers — but read-only: nothing to select,
 * move or edit. For previewing a template.
 */
export function StaticCanvas({ blocks }: { blocks: readonly Block[] }) {
  const numbers = questionNumbers(blocks);
  let pageNumber = 0;
  const render = (list: readonly Block[], level: number): React.ReactNode[] =>
    list.map((block) => {
      if (isPage(block)) {
        pageNumber += 1;
        return (
          <section key={block.id} className={cn(PAGE_BOX, "border-rule-strong")}>
            <div className={cn(PAGE_HEADER, "rounded-t-[0.75rem] border-b border-rule bg-paper-sunk")}>
              <PageLabel number={pageNumber} />
              <span aria-hidden="true" className="text-graphite-soft">·</span>
              <span className="min-w-0 truncate text-[0.9375rem] font-semibold">{block.title || "Untitled page"}</span>
              <BlockChips block={block} />
            </div>
            <div className="flex flex-col gap-2.5 p-3">{render(block.blocks, 0)}</div>
          </section>
        );
      }
      if (isGroup(block)) {
        return (
          <GroupBox
            key={block.id}
            group={block}
            level={level}
            selected={false}
            dropTarget={false}
            dimmed={false}
            header={
              <div className="px-1.5 py-2.5">
                <StaticHeader block={block} />
              </div>
            }
          >
            {render(block.blocks, level + 1)}
          </GroupBox>
        );
      }
      return (
        <div key={block.id} className="rounded-[0.625rem] border border-transparent p-3.5">
          <div className="mb-2.5">
            <StaticHeader block={block} number={numbers.get(block.id)} />
          </div>
          <BlockPreview block={block} />
        </div>
      );
    });
  return <div className="flex flex-col gap-2.5">{render(blocks, 0)}</div>;
}
