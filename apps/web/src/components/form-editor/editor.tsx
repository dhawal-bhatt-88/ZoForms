"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, type SortingStrategy } from "@dnd-kit/sortable";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GripVertical,
  Inbox,
  LayoutTemplate,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  addGridColumn,
  allBlockIds,
  canInsertAsPage,
  answerCode,
  applyImport,
  BLOCK_META,
  blockName,
  canBeRequired,
  columnTypeChangeWarning,
  conditionAnswerOptions,
  conditionNumbersInText,
  DEFAULT_DRAFT_MODE,
  deletePageKeepingContents,
  deletePageWithContents,
  deletionBlockers,
  dependentsOf,
  displayBlockProblem,
  draftModeAvailable,
  draftsWithoutDefault,
  CODE_PATTERN,
  COMPLETE_REQUIRED_LABELS,
  fillCodeAt,
  findBlock,
  GROUP_TEMPLATE_TITLE,
  groupFromTemplate,
  INSERT_AS_PAGE_UNAVAILABLE,
  pageForTemplateGroup,
  templateAsForm,
  templateFromForm,
  gridColumnName,
  insertBlockIntoTree,
  insertPageAfter,
  isAnswerable,
  isChoiceColumn,
  isContainer,
  isGrid,
  isGroup,
  isPage,
  isPaged,
  isRepeatingGroup,
  logicTreeToText,
  makePaged,
  moveBlockInTree,
  moveGridColumn,
  movePage,
  NAVIGATION_DEFAULTS,
  navigationWithoutDefaults,
  newBlock,
  newConditionId,
  newGroup,
  newPage,
  normalizeConditions,
  normalizeScores,
  pageContentsDestination,
  prefixRuleBreaker,
  problemsBesideContent,
  removePaging,
  NUMERIC_SOURCE_TYPES,
  OPTION_SOURCE_TYPES,
  OPTION_TYPES,
  optionListAt,
  optionListProblems,
  parseLogicText,
  parseOptionFile,
  placeholderOptions,
  questionNumbers,
  removeBlockFromTree,
  renameOptionCode,
  renumberAfterDelete,
  replaceBlockers,
  REPEAT_DEFAULTS,
  repeatsOnBlockers,
  repeatSettingsProblems,
  resolveTheme,
  sameContent,
  sameOptionList,
  sourceOperators,
  structureBreaks,
  unwrapGroup,
  updateBlockInTree,
  updateGridColumn,
  walkBlocks,
  withColumnType,
  withOptionList,
  type AnyBlockType,
  type Block,
  type Condition,
  type ConditionOperator,
  type ContainerBlock,
  type DraftMode,
  FormSchema,
  type ImportMode,
  type ImportPreviewRow,
  type Option,
  type ParsedImport,
  type OptionListRef,
  type GridColumn,
  type GridColumnType,
  type GroupBlock,
  type Navigation,
  type PageBlock,
  type PageEdit,
  type TreeEntry,
} from "@formbuilder/form-schema";
import {
  flattenVisible,
  getProjection,
  moveDestinations,
  stepMove,
  type FlatItem,
  type MoveTarget,
} from "@/lib/tree-dnd";
import { inspectorHeading, logicNoun } from "@/lib/inspector";
import { parseCount, repeatBadgeText, repeatPreviewText } from "@/lib/repeat-settings";
import { OptionImportDialog } from "@/components/option-import-dialog";
import { CodeChangeNote, OptionListEditor } from "@/components/option-list-editor";
import { GridColumnsEditor } from "@/components/grid-columns-editor";
import { Switch } from "@/components/switch";
import { MenuButton, type MenuItem } from "@/components/menu-button";
import { SaveTemplateDialog } from "@/components/templates/save-template-dialog";
import { TemplatePicker } from "@/components/templates/template-picker";
import { useCanEdit } from "@/lib/use-can-edit";
import { BlockPreview, DropLine, GroupBox, ICONS, MAX_INDENT_LEVELS } from "./canvas-preview";
import {
  ApiError,
  downloadArtifact,
  editForm,
  getForm,
  getTemplate,
  saveSchema,
  updateTemplate,
  suggestLogic,
  translateForm,
  type FormStatus,
  type TemplateDetail,
  type TemplateKind,
  type TemplateScope,
  type LogicSuggestion,
} from "@/lib/api";

type AiMsg = { role: "user" | "assistant"; text: string; changes?: string[] };

type CatalogItem = {
  // Pages are added with their own control, never from the block menu.
  type: Exclude<AnyBlockType, "page">;
  label?: string;
  keywords?: string;
  level?: number;
  soon?: boolean;
  /** "From template…": opens the template picker instead of adding a block. */
  template?: true;
};

/** The slash-menu block catalog, grouped by category. */
const CATALOG: { group: string; items: CatalogItem[] }[] = [
  {
    group: "Structure",
    items: [
      { type: "group", label: "Group", keywords: "section fieldset container nest" },
      { type: "group", label: "From template…", keywords: "template saved reuse library", template: true },
    ],
  },
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
      // Before Matrix, whose keywords include "grid": "grid" + Enter picks the first match.
      { type: "grid", keywords: "table cells columns" },
      { type: "matrix", keywords: "grid table" },
      { type: "rating", keywords: "stars" },
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
      { type: "video", keywords: "youtube vimeo mp4 webm" },
      { type: "audio", keywords: "sound" },
      { type: "embed", keywords: "iframe anything" },
    ],
  },
  {
    group: "Advanced",
    items: [
      { type: "hidden", keywords: "hidden field prefill" },
      { type: "country", keywords: "geo location" },
    ],
  },
];

function catalogLabel(item: CatalogItem): string {
  return item.label ?? (item.type === "group" ? "Group" : BLOCK_META[item.type].label);
}

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
      const label = catalogLabel(it).toLowerCase();
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
            const Icon = it.template ? LayoutTemplate : ICONS[it.type];
            const label = catalogLabel(it);
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

/* ---------- canvas: cards, group ends, dialogs ---------- */

/** How far a drag must move sideways to change depth by one level, in px. */
const DRAG_INDENT = 28;

/**
 * Cards stay where they are while dragging: nested boxes can't make room for
 * cards sliding past their edges. The drop line and the highlighted box show
 * where the block will land instead.
 */
const noDisplacement: SortingStrategy = () => null;

/**
 * A page on the canvas: a stronger container than a group box, with a header
 * bar reading "Page 2 · <title>" (the title edits in place) and its blocks
 * below. The header is where blocks can be dropped at the page's start; the
 * page itself is never dragged — it moves with Move page up / down.
 */
function PageBox({
  item,
  pageNumber,
  selected,
  dropTarget,
  canMoveUp,
  canMoveDown,
  onlyPage,
  onSelect,
  onTitle,
  onToggle,
  onMove,
  onDelete,
  onRemovePages,
  children,
}: {
  item: FlatItem;
  pageNumber: number;
  selected: boolean;
  dropTarget: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** The last page left: offer "Remove pages" instead of delete. */
  onlyPage: boolean;
  onSelect: () => void;
  onTitle: (title: string) => void;
  onToggle: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onRemovePages: () => void;
  children: React.ReactNode;
}) {
  // A drop target (a block dropped on the header lands inside), never dragged itself.
  const { setNodeRef } = useSortable({ id: item.id, disabled: { draggable: true, droppable: false } });
  const page = item.block as PageBlock;
  const name = page.title.trim() || `Page ${pageNumber}`;
  const hiddenCount = item.collapsed ? walkBlocks(page.blocks).length : 0;
  const iconButton =
    "grid h-7 w-7 flex-none place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:opacity-30";
  return (
    <section
      data-page-box={page.id}
      data-drop-target={dropTarget || undefined}
      className={`relative rounded-2xl border-2 bg-surface transition-[border-color,box-shadow] ${
        dropTarget
          ? "border-accent ring-2 ring-accent/30"
          : selected
            ? "border-accent ring-2 ring-accent-weak"
            : "border-ink/15"
      }`}
    >
      <div
        ref={setNodeRef}
        data-block-id={page.id}
        data-depth={0}
        onClick={onSelect}
        className={`flex cursor-pointer items-center gap-2 bg-ink/[0.045] px-3 py-2 ${
          item.collapsed ? "rounded-[14px]" : "rounded-t-[14px] border-b border-ink/10"
        } ${dropTarget ? "bg-accent-weak" : ""}`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-expanded={!item.collapsed}
          aria-label={item.collapsed ? `Expand page "${name}"` : `Collapse page "${name}"`}
          className={iconButton}
        >
          {item.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span className="flex-none text-[12px] font-bold uppercase tracking-wider text-muted">
          Page {pageNumber}
        </span>
        <span aria-hidden="true" className="flex-none text-faint">
          ·
        </span>
        <input
          value={page.title}
          aria-label={`Page ${pageNumber} title`}
          placeholder="Untitled page"
          onChange={(e) => onTitle(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={onSelect}
          className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1 py-0.5 text-[15px] font-semibold outline-none hover:bg-surface focus:bg-surface"
          spellCheck={false}
        />
        {!!page.enableWhen?.length && (
          <span className="flex-none rounded-full bg-accent-weak px-2 py-0.5 text-[11px] font-semibold text-accent-2">
            Conditional
          </span>
        )}
        {item.collapsed && (
          <span className="flex-none text-xs text-muted">
            {hiddenCount} {hiddenCount === 1 ? "block" : "blocks"} inside
          </span>
        )}
        <div className="flex flex-none items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(-1);
            }}
            disabled={!canMoveUp}
            className={iconButton}
            aria-label="Move page up"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(1);
            }}
            disabled={!canMoveDown}
            className={iconButton}
            aria-label="Move page down"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          {onlyPage ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemovePages();
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-ink"
            >
              Remove pages
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className={`${iconButton} hover:!bg-[#FCECEC] hover:!text-red`}
              aria-label="Delete page"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {children && <div className="flex flex-col gap-2.5 p-3">{children}</div>}
    </section>
  );
}

function CanvasCard({
  item,
  number,
  selected,
  canMoveUp,
  canMoveDown,
  onSelect,
  onDelete,
  onMove,
  onToggle,
  dropLine,
  menu,
  locked = false,
}: {
  item: FlatItem;
  /** Question number, for answerable questions. */
  number?: number;
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  /** Leaves only; a group's drop line is drawn by its box. */
  dropLine?: "top" | "bottom";
  /** A group's "⋯" menu, when it has one. */
  menu?: MenuItem[];
  /** A group template's own group: it can't be moved or deleted, so it has no controls for that. */
  locked?: boolean;
}) {
  // The card itself never moves while dragging; a DragOverlay follows the pointer.
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: item.id });
  const block = item.block;
  const group = isGroup(block) ? block : null;
  const depth = item.depth;
  const level = item.level;
  const Icon = ICONS[block.type];
  const hiddenCount = group && item.collapsed ? walkBlocks(group.blocks).length : 0;

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      data-depth={depth}
      onClick={onSelect}
      className={`group relative cursor-pointer transition-colors ${
        group
          ? // A group's card is the header inside its box; the box shows selection.
            "rounded-lg px-1.5 py-2.5"
          : `rounded-xl border p-3.5 ${
              selected
                ? "border-accent bg-white ring-2 ring-accent-weak"
                : "border-transparent hover:border-line-2 hover:bg-surface-2"
            }`
      } ${isDragging && !group ? "opacity-40" : ""}`}
    >
      {dropLine && <DropLine at={dropLine} />}
      <div className={`flex items-center gap-2 ${group ? "" : "mb-2.5"} pr-[88px]`}>
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab text-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {group && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-expanded={!item.collapsed}
            aria-label={item.collapsed ? `Expand group "${group.label}"` : `Collapse group "${group.label}"`}
            className="grid h-6 w-6 flex-none place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"
          >
            {item.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
        <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-md bg-accent-weak text-accent-2">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {number !== undefined && (
          <span className="flex-none text-[13px] font-semibold tabular-nums text-muted">{number}.</span>
        )}
        <span className={`min-w-0 truncate font-semibold ${group && !group.label.trim() ? "italic text-faint" : ""}`}>
          {group && !group.label.trim() ? "Unlabelled group" : blockName(block)}
        </span>
        {/* "Answer every row" / "Rank every option" make the question required too (the renderer's rule). */}
        {(block.required || block.completeRequired) && <span className="text-red">*</span>}
        {group && isRepeatingGroup(group) && (
          <span
            data-repeat-badge
            // Bordered: group boxes alternate shading, and a filled pill vanished on the grey ones.
            className="flex-none rounded-full border border-line-2 bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-2"
          >
            {repeatBadgeText(group)}
          </span>
        )}
        {!!block.enableWhen?.length && (
          <span className="flex-none rounded-full bg-accent-weak px-2 py-0.5 text-[11px] font-semibold text-accent-2">
            Conditional
          </span>
        )}
        {level > MAX_INDENT_LEVELS && (
          <span className="flex-none rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-muted">
            Level {level + 1}
          </span>
        )}
        {group && item.collapsed && (
          <span className="flex-none text-xs text-muted">
            {hiddenCount} {hiddenCount === 1 ? "block" : "blocks"} inside
          </span>
        )}
      </div>
      {!group && <BlockPreview block={block} />}

      {/* Visible on hover, and whenever focus is inside the card, so these work from the keyboard. */}
      <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {group && menu && <MenuButton label={`More actions for group "${blockName(group).trim() || "Unlabelled group"}"`} items={menu} />}
        {!locked && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
              }}
              disabled={!canMoveUp}
              className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink disabled:opacity-30"
              aria-label="Move up"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove(1);
              }}
              disabled={!canMoveDown}
              className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink disabled:opacity-30"
              aria-label="Move down"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-[#FCECEC] hover:text-red"
              aria-label={group ? "Delete group" : "Delete"}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The last row inside an open page or group: a way to add to it. */
function ContainerEnd({
  container: group,
  dropLine,
  onAdd,
}: {
  container: ContainerBlock;
  /** A block dropped now would land at the end of this page or group. */
  dropLine: boolean;
  onAdd: (anchor: HTMLElement) => void;
}) {
  const name = blockName(group).trim() || (isPage(group) ? "this page" : "this group");
  return (
    <div className="relative">
      {dropLine && <DropLine at="top" />}
      <button
        onClick={(e) => onAdd(e.currentTarget)}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] hover:bg-surface-2 hover:text-accent-2 ${
          group.blocks.length ? "text-muted" : "text-amber"
        }`}
      >
        <Plus className="h-3.5 w-3.5" />
        {group.blocks.length ? `Add to "${name}"` : `"${name}" is empty — add a block to it`}
      </button>
    </div>
  );
}

/** What follows the pointer while dragging: the block's icon and label. */
function DragGhost({ block }: { block: Block }) {
  const Icon = ICONS[block.type];
  const inside = isGroup(block) ? walkBlocks(block.blocks).length : 0;
  return (
    <div className="flex h-full items-start gap-2 rounded-xl border border-accent bg-white px-3.5 py-2.5 shadow-pop">
      <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-md bg-accent-weak text-accent-2">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 truncate font-semibold">{blockName(block).trim() || "Unlabelled group"}</span>
      {isGroup(block) && (
        <span className="flex-none pt-0.5 text-xs text-muted">
          {inside} {inside === 1 ? "block" : "blocks"} inside
        </span>
      )}
    </div>
  );
}

/** "<question> <condition> <answer>", as the author would say it: an option's label, not its code (contract §13.4). */
function conditionPhrase(c: Condition, blocks: readonly Block[]): string {
  const source = findBlock(blocks, c.question)?.block;
  const label = source ? conditionAnswerOptions(source)?.find((o) => o.code === c.answer)?.label : undefined;
  const answer = c.operator === "exists" ? "" : ` ${label ?? c.answer}`;
  return `${source ? blockName(source) : "a missing question"} ${OPERATOR_TEXT[c.operator]}${answer}`;
}

/** "Show when <question> <condition> <answer>". */
function describeCondition(c: Condition, blocks: readonly Block[]): string {
  return `Show when ${conditionPhrase(c, blocks)}`;
}

/**
 * An item's conditions as one phrase, combined as its logic says (contract
 * §15): "A and B", "A or (B and C)". Logic text that doesn't parse can't be
 * put in words, so the conditions are listed with the text as typed.
 */
function logicPhrase(item: Block, phrases: readonly string[]): string {
  if (phrases.length < 2) return phrases[0] ?? "";
  const parsed = parseLogicText(item.enableLogicText ?? "", phrases.length);
  if (!parsed.ok) return `${phrases.join(", ")} (combined as "${item.enableLogicText ?? ""}")`;
  // The tree's own text, in brackets where it nests, with numbers and words replaced in one pass.
  return logicTreeToText(parsed.tree).replace(/\d+|AND|OR/g, (t) =>
    t === "AND" ? "and" : t === "OR" ? "or" : phrases[Number(t) - 1],
  );
}

/**
 * What deleting a container "but keeping its contents" costs, in words: the
 * container's own conditions no longer apply to what it held. Null when it
 * has no conditions.
 */
function lostConditionsNote(container: ContainerBlock, blocks: readonly Block[], whom: string): string | null {
  const conditions = container.enableWhen ?? [];
  if (!conditions.length) return null;
  const quoted = conditions.map((c) => `'${describeCondition(c, blocks)}'`);
  return `The ${conditions.length === 1 ? "condition" : "conditions"} ${logicPhrase(container, quoted)} will no longer apply to ${whom}.`;
}

/** "this question", "these 3 questions", or "its contents" when none are questions. */
function questionsWhom(blocks: readonly Block[]): string {
  const questions = walkBlocks(blocks).filter((e) => isAnswerable(e.block)).length;
  return questions === 0 ? "its contents" : questions === 1 ? "this question" : `these ${questions} questions`;
}

/**
 * The two ways to delete a group. Keeping its questions moves them up to where
 * the group was; the group's own conditions don't carry over, so the dialog says
 * which conditions stop applying and to how many questions.
 */
function DeleteGroupDialog({
  group,
  blocks,
  onKeep,
  onDeleteAll,
  onClose,
}: {
  group: GroupBlock;
  blocks: readonly Block[];
  onKeep: () => void;
  onDeleteAll: () => void;
  onClose: () => void;
}) {
  const inside = walkBlocks(group.blocks);
  const name = group.label.trim() || "this group";
  const conditionNote = lostConditionsNote(group, blocks, questionsWhom(group.blocks));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-group-title"
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 id="delete-group-title" className="text-base font-semibold">
          Delete the group &quot;{name}&quot;?
        </h2>
        <p className="mt-1 text-sm text-muted">
          It contains {inside.length} {inside.length === 1 ? "block" : "blocks"}. Choose what happens to them.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            autoFocus
            onClick={onKeep}
            className="rounded-xl border border-line-2 px-4 py-3 text-left hover:border-accent hover:bg-accent-weak"
          >
            <span className="block text-sm font-semibold">Group only (keep questions)</span>
            <span className="mt-0.5 block text-[13px] text-muted">
              Its contents move up to where the group is now, in the same order.
            </span>
            {conditionNote && (
              <span className="mt-1.5 block rounded-md bg-[#FBF0D9] px-2 py-1.5 text-[13px] text-ink-2">
                {conditionNote}
              </span>
            )}
          </button>
          <button
            onClick={onDeleteAll}
            className="rounded-xl border border-line-2 px-4 py-3 text-left hover:border-red hover:bg-[#FCECEC]"
          >
            <span className="block text-sm font-semibold text-red">Group and its questions</span>
            <span className="mt-0.5 block text-[13px] text-muted">
              Deletes the group and all {inside.length} {inside.length === 1 ? "block" : "blocks"} inside it.
            </span>
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="btn btn-outline btn-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The two ways to delete a page. "Page only" moves its contents to the end of
 * the previous page (or the start of the next, for the first page). The dialog
 * says what that changes: the page's own conditions stop applying, and moving
 * into a conditional page makes the contents conditional on it. Both notes show
 * when both apply. Refusals come back through the standard banner.
 */
function DeletePageDialog({
  page,
  blocks,
  onKeep,
  onDeleteAll,
  onClose,
}: {
  page: PageBlock;
  blocks: readonly Block[];
  onKeep: () => void;
  onDeleteAll: () => void;
  onClose: () => void;
}) {
  const inside = walkBlocks(page.blocks);
  const first = blocks[0]?.id === page.id;
  const name = page.title.trim() || "this page";
  const whom = questionsWhom(page.blocks);
  const lostNote = lostConditionsNote(page, blocks, whom);
  const destination = pageContentsDestination(blocks, page.id);
  // Into the previous page only: moving the first page's contents into a
  // conditional next page is refused (it would become a conditional first page).
  const destinationConditions = !first ? (destination?.enableWhen ?? []) : [];
  const gainedNote = destinationConditions.length
    ? `${whom.charAt(0).toUpperCase()}${whom.slice(1)} will move to '${destination!.title}' and will only show when ${logicPhrase(
        destination!,
        destinationConditions.map((c) => conditionPhrase(c, blocks)),
      )}.`
    : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-page-title"
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 id="delete-page-title" className="text-base font-semibold">
          Delete the page &quot;{name}&quot;?
        </h2>
        <p className="mt-1 text-sm text-muted">
          It contains {inside.length} {inside.length === 1 ? "block" : "blocks"}. Choose what happens to them.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            autoFocus
            onClick={onKeep}
            className="rounded-xl border border-line-2 px-4 py-3 text-left hover:border-accent hover:bg-accent-weak"
          >
            <span className="block text-sm font-semibold">
              Page only (move contents to the {first ? "next" : "previous"} page)
            </span>
            <span className="mt-0.5 block text-[13px] text-muted">
              {first
                ? `Its contents move to the start of "${destination?.title ?? "the next page"}", in the same order.`
                : `Its contents move to the end of "${destination?.title ?? "the previous page"}", in the same order.`}
            </span>
            {[lostNote, gainedNote].filter(Boolean).map((note) => (
              <span key={note} className="mt-1.5 block rounded-md bg-[#FBF0D9] px-2 py-1.5 text-[13px] text-ink-2">
                {note}
              </span>
            ))}
          </button>
          <button
            onClick={onDeleteAll}
            className="rounded-xl border border-line-2 px-4 py-3 text-left hover:border-red hover:bg-[#FCECEC]"
          >
            <span className="block text-sm font-semibold text-red">Page and its contents</span>
            <span className="mt-0.5 block text-[13px] text-muted">
              Deletes the page and all {inside.length} {inside.length === 1 ? "block" : "blocks"} on it.
            </span>
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="btn btn-outline btn-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** The confirm before a single-page form becomes a paged one. */
function PagingDialog({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paging-title"
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 id="paging-title" className="text-base font-semibold">
          Split this form into pages?
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Your questions will move to Page 1, and a new, empty Page 2 is added after it.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-outline btn-sm">
            Cancel
          </button>
          <button autoFocus onClick={onConfirm} className="btn btn-primary btn-sm">
            Add pages
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Keyboard-friendly moving: up, down (stepping out of a group at its ends, or
 * into the neighbouring page at a page's ends) and straight into any page or
 * group with "Move to…". Every move goes through the same dependency guard as
 * dragging. A page moves only up or down, as a whole.
 */
function PositionPanel({
  blocks,
  blockId,
  onMove,
  onMovePage,
  rootLocked = false,
}: {
  blocks: readonly Block[];
  blockId: string;
  onMove: (target: MoveTarget) => void;
  onMovePage: (direction: -1 | 1) => void;
  /** A group template: nothing may move to the top level, beside its group. */
  rootLocked?: boolean;
}) {
  const [destination, setDestination] = useState("");
  const pageAt = blocks.findIndex((b) => b.id === blockId && isPage(b));
  const allowed = (t: MoveTarget | null) => (rootLocked && t?.parentId === null ? null : t);
  const up = allowed(stepMove(blocks, blockId, -1));
  const down = allowed(stepMove(blocks, blockId, 1));
  const destinations = moveDestinations(blocks, blockId).filter((d) => !(rootLocked && d.id === null));
  const ROOT = "__top_level__";

  function moveInto() {
    if (!destination) return;
    const parentId = destination === ROOT ? null : destination;
    const target = parentId ? findBlock(blocks, parentId)?.block : null;
    // Appended at the end: the moving block isn't among the destination's children.
    const index = target && isContainer(target) ? target.blocks.length : blocks.length;
    onMove({ parentId, index });
    setDestination("");
  }

  if (pageAt >= 0) {
    return (
      <div className="mt-3 border-t border-line pt-3">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">Position</h4>
        <div className="flex gap-1.5">
          <button
            onClick={() => onMovePage(-1)}
            disabled={pageAt === 0}
            className="btn btn-outline btn-sm flex-1 disabled:opacity-40"
          >
            <ArrowUp className="h-3.5 w-3.5" /> Move up
          </button>
          <button
            onClick={() => onMovePage(1)}
            disabled={pageAt === blocks.length - 1}
            className="btn btn-outline btn-sm flex-1 disabled:opacity-40"
          >
            <ArrowDown className="h-3.5 w-3.5" /> Move down
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">Position</h4>
      <div className="mb-2 flex gap-1.5">
        <button
          onClick={() => up && onMove(up)}
          disabled={!up}
          className="btn btn-outline btn-sm flex-1 disabled:opacity-40"
        >
          <ArrowUp className="h-3.5 w-3.5" /> Move up
        </button>
        <button
          onClick={() => down && onMove(down)}
          disabled={!down}
          className="btn btn-outline btn-sm flex-1 disabled:opacity-40"
        >
          <ArrowDown className="h-3.5 w-3.5" /> Move down
        </button>
      </div>
      <div className="flex gap-1.5">
        <select
          aria-label="Move to"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-accent"
        >
          <option value="">Move to…</option>
          {destinations.map((d) => (
            <option key={d.id ?? ROOT} value={d.id ?? ROOT}>
              {d.id === null ? "Top level (outside any group)" : d.path.join(" › ")}
            </option>
          ))}
        </select>
        <button onClick={moveInto} disabled={!destination} className="btn btn-outline btn-sm disabled:opacity-40">
          Move
        </button>
      </div>
    </div>
  );
}

/* ---------- conditional logic panel ---------- */

const OPERATOR_TEXT: Record<ConditionOperator, string> = {
  exists: "is answered",
  "=": "is",
  "!=": "is not",
  contains: "includes",
  ">": "is greater than",
  "<": "is less than",
  ">=": "is at least",
  "<=": "is at most",
};

/** A starting answer that satisfies the rules for `source`. */
function defaultAnswer(source: Block): string | number {
  const answers = conditionAnswerOptions(source);
  if (answers) return answers[0]?.code ?? "";
  if (NUMERIC_SOURCE_TYPES.includes(source.type)) return source.type === "scale" ? (source.min ?? 1) : 1;
  return "";
}

/**
 * `c` pointed at `source` with `operator`; the answer is kept only if it still
 * applies. `firstAnswer` gives a coded source's starting answer, which may need
 * its code generated first (contract §13.3).
 */
function retarget(
  c: Condition,
  source: Block,
  operator: ConditionOperator,
  firstAnswer: (source: Block) => string | number,
): Condition {
  // The condition stays the same condition: its id (contract §15.1) is kept.
  const id = c.id === undefined ? {} : { id: c.id };
  if (operator === "exists") return { ...id, question: source.id, operator };
  const keep = c.question === source.id && c.answer !== undefined;
  return { ...id, question: source.id, operator, answer: keep ? c.answer : firstAnswer(source) };
}

const logicField =
  "min-w-0 flex-1 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-accent";

/**
 * Number box that lets the author clear and retype without the value snapping
 * back. A stored answer that isn't a number shows as empty; the panel's inline
 * problem explains why.
 */
function NumberAnswer({ label, value, onChange }: { label: string; value?: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    if (value === undefined) setText("");
    else if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      aria-label={label}
      type="number"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
      className={logicField}
    />
  );
}

/**
 * Answer input matched to the source: a fixed list (options or countries), a
 * number, or free text. A list shows labels and stores codes (contract §13.4);
 * `pick` gives the code for the chosen entry, generating it if it is empty.
 */
function AnswerInput({
  label,
  source,
  value,
  onChange,
  pick,
}: {
  /** The accessible name, e.g. "Condition 2 answer". */
  label: string;
  source: Block;
  value: Condition["answer"];
  onChange: (v: string | number) => void;
  pick: (source: Block, index: number) => string;
}) {
  const options = conditionAnswerOptions(source);
  if (options) {
    // Entries are told apart by position: an option's code may still be empty.
    const current = typeof value === "string" && value ? options.findIndex((o) => o.code === value) : -1;
    return (
      <select
        aria-label={label}
        value={current >= 0 ? String(current) : ""}
        onChange={(e) => onChange(pick(source, Number(e.target.value)))}
        className={logicField}
      >
        {current < 0 && <option value="">{typeof value === "string" && value ? value : "Choose…"}</option>}
        {options.map((o, k) => (
          <option key={k} value={String(k)}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (NUMERIC_SOURCE_TYPES.includes(source.type)) {
    return <NumberAnswer label={label} value={typeof value === "number" ? value : undefined} onChange={onChange} />;
  }
  return (
    <input
      aria-label={label}
      value={value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Answer"
      className={logicField}
    />
  );
}

const LOGIC_HINT = "Use condition numbers, AND, OR and brackets, e.g. 1 AND (2 OR 3)";
/** How long after the author stops typing the logic text is checked. */
const LOGIC_CHECK_DELAY_MS = 500;

/**
 * "Show this question/group only when…" — edits a block's enableWhen and,
 * with two or more conditions, the logic text that combines them (contract
 * §15.6). Conditions are numbered 1…n in stored order and can't be reordered.
 * Sources are the eligible questions that come before this block in reading
 * order, numbered as on the canvas and listed under the path of groups they sit in.
 */
function ConditionsPanel({
  block,
  blocks,
  onChange,
  pickAnswer,
}: {
  block: Block;
  blocks: Block[];
  onChange: (p: Partial<Block>) => void;
  /** The code to store for option `index` of a coded source, generated if empty (contract §13.3). */
  pickAnswer: (sourceId: string, index: number) => string;
}) {
  // A coded source's entries are its options; a country source's are names, already codes.
  const pick = (source: Block, index: number) =>
    OPTION_SOURCE_TYPES.includes(source.type) ? pickAnswer(source.id, index) : (conditionAnswerOptions(source)?.[index]?.code ?? "");
  const firstAnswer = (source: Block) => (conditionAnswerOptions(source) ? pick(source, 0) : defaultAnswer(source));
  const entries = walkBlocks(blocks);
  const self = entries.find((e) => e.block.id === block.id);
  const at = self?.order ?? entries.length;
  // Only questions before it in reading order can be used, which also rules out cycles.
  const earlier = entries.filter((e) => e.order < at && sourceOperators(e.block));
  // And none inside a repeating group it isn't in: there'd be no telling which entry to read (contract §12.3).
  const sources = self ? earlier.filter((e) => !prefixRuleBreaker(e, self)) : earlier;
  const hiddenByRepeats = earlier.length > sources.length;
  const numbers = questionNumbers(blocks);
  const noun = logicNoun(block);
  const conditions = block.enableWhen ?? [];
  const text = block.enableLogicText ?? "";
  // A display block's own content message is shown once, under its field, not
  // here; so is the logic text's.
  const problems = problemsBesideContent({ blocks }, block.id).map((p) => p.detail);

  // The logic text is checked once the author pauses typing or leaves the field
  // (contract §15.6). `checked` is the text as it was then; a change made any
  // other way (a deletion's renumbering, Cancel, a save) is checked at once.
  const [checked, setChecked] = useState(text);
  const typed = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (text !== typed.current) {
      typed.current = text;
      setChecked(text);
    }
  }, [text]);
  const parsed = conditions.length >= 2 ? parseLogicText(checked, conditions.length) : null;
  const logicError = parsed && !parsed.ok ? parsed.error : null;
  // A refused deletion, shown under its condition: the condition's key and the message.
  const [refusal, setRefusal] = useState<{ key: string; message: string } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const fieldId = `logic-text-${block.id}`;

  // Consecutive sources in the same group share one <optgroup> labelled with its path.
  const runs: { path: string; entries: TreeEntry[] }[] = [];
  for (const e of sources) {
    const path = e.ancestors.map(blockName).join(" › ");
    const last = runs[runs.length - 1];
    if (last && last.path === path) last.entries.push(e);
    else runs.push({ path, entries: [e] });
  }
  const sourceOptions = runs.map((run, r) => {
    const options = run.entries.map((e) => (
      <option key={e.block.id} value={e.block.id}>
        {numbers.get(e.block.id)}. {blockName(e.block)}
      </option>
    ));
    return run.path ? (
      <optgroup key={r} label={run.path}>
        {options}
      </optgroup>
    ) : (
      options
    );
  });

  // The text exists only with two or more conditions. The tree and
  // enableBehavior are never stored: the artifact derives them from the text.
  const commit = (next: Condition[], nextText: string | undefined) =>
    onChange({
      enableWhen: next.length ? next : undefined,
      enableBehavior: undefined,
      enableLogic: undefined,
      enableLogicText: next.length >= 2 ? nextText : undefined,
    });
  const setAt = (i: number, c: Condition) => commit(conditions.map((x, k) => (k === i ? c : x)), block.enableLogicText);
  const keyOf = (c: Condition, i: number) => c.id ?? String(i);

  function addCondition() {
    const taken = conditions.flatMap((c) => (c.id ? [c.id] : []));
    // Default to the nearest eligible question before it, "is answered".
    const added: Condition = { id: newConditionId(taken), question: sources[sources.length - 1].block.id, operator: "exists" };
    // The second condition brings the logic field, pre-filled; after that the text is left alone.
    commit([...conditions, added], conditions.length === 1 ? "1 AND 2" : block.enableLogicText);
    setRefusal(null);
  }

  function removeCondition(i: number) {
    const n = i + 1;
    // Refused while the text mentions its number anywhere, even text with errors.
    if (conditions.length >= 2 && conditionNumbersInText(text).includes(n)) {
      setRefusal({ key: keyOf(conditions[i], i), message: `Condition ${n} is used in the logic. Remove it from the logic first.` });
      return;
    }
    setRefusal(null);
    const next = conditions.filter((_, k) => k !== i);
    commit(next, next.length >= 2 ? renumberAfterDelete(text, n) : undefined);
    addButton.current?.focus();
  }

  function typeLogic(value: string) {
    typed.current = value;
    onChange({ enableLogicText: value });
    setRefusal(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setChecked(value), LOGIC_CHECK_DELAY_MS);
  }

  // Nothing comes before the first page, so it's always shown (contract §3.2).
  if (isPage(block) && blocks[0]?.id === block.id && !conditions.length) {
    return (
      <div className="border-t border-line pt-3">
        <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">Logic</h4>
        <p className="text-xs text-muted">The first page can&apos;t have conditions — it is always shown.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-line pt-3">
      <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">Logic</h4>
      <p className="mb-2 text-[12.5px] font-semibold text-ink-2">Show this {noun} only when…</p>

      <div className="flex flex-col gap-2">
        {conditions.map((c, i) => {
          const n = i + 1;
          const source = findBlock(blocks, c.question)?.block;
          const eligible = !!source && sources.some((e) => e.block.id === source.id);
          const operators = source ? (sourceOperators(source) ?? []) : [];
          const key = keyOf(c, i);
          const refused = refusal?.key === key ? refusal.message : null;
          const refusalId = `condition-refusal-${block.id}-${key}`;
          return (
            <div key={key} className="rounded-lg border border-line bg-surface-2 p-2">
              <div className="mb-1.5 flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Condition {n}</span>
                <button
                  onClick={() => removeCondition(i)}
                  className="grid h-7 w-7 flex-none place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink"
                  aria-label={`Remove condition ${n}`}
                  aria-describedby={refused ? refusalId : undefined}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <select
                aria-label={`Condition ${n} question`}
                value={c.question}
                onChange={(e) => {
                  const next = findBlock(blocks, e.target.value)!.block;
                  const ops = sourceOperators(next) ?? [];
                  setAt(i, retarget(c, next, ops.includes(c.operator) ? c.operator : "exists", firstAnswer));
                }}
                className={`${logicField} mb-1.5 w-full`}
              >
                {!eligible && <option value={c.question}>{source ? blockName(source) : "Missing question"}</option>}
                {sourceOptions}
              </select>
              <div className="flex items-center gap-1.5">
                <select
                  aria-label={`Condition ${n} operator`}
                  value={c.operator}
                  disabled={!source}
                  onChange={(e) => source && setAt(i, retarget(c, source, e.target.value as ConditionOperator, firstAnswer))}
                  className={logicField}
                >
                  {!operators.includes(c.operator) && <option value={c.operator}>{OPERATOR_TEXT[c.operator]}</option>}
                  {operators.map((op) => (
                    <option key={op} value={op}>
                      {OPERATOR_TEXT[op]}
                    </option>
                  ))}
                </select>
                {c.operator !== "exists" && source && (
                  <AnswerInput
                    label={`Condition ${n} answer`}
                    source={source}
                    value={c.answer}
                    onChange={(a) => setAt(i, { ...c, answer: a })}
                    pick={pick}
                  />
                )}
              </div>
              <div id={refusalId} aria-live="polite">
                {refused && (
                  <p className="mt-1.5 flex items-start gap-1 text-xs text-red">
                    <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
                    {refused}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sources.length ? (
        <button
          ref={addButton}
          onClick={addCondition}
          className="mt-2 flex items-center gap-1.5 text-sm font-medium text-accent-2 hover:underline"
        >
          <Plus className="h-4 w-4" /> Add condition
        </button>
      ) : (
        !hiddenByRepeats && (
          <p className="text-xs text-muted">
            Only questions before this {noun} can be used. Add or move a question before it first.
          </p>
        )
      )}

      {conditions.length >= 2 && (
        <div className="mt-3">
          <label htmlFor={fieldId} className="mb-1 block text-xs font-semibold text-ink-2">
            Logic
          </label>
          <textarea
            id={fieldId}
            value={text}
            rows={2}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={logicError ? true : undefined}
            aria-describedby={`${fieldId}-hint ${fieldId}-error`}
            onChange={(e) => typeLogic(e.target.value)}
            onBlur={(e) => {
              clearTimeout(timer.current);
              setChecked(e.target.value);
            }}
            className={`block w-full resize-y rounded-lg border bg-surface px-2.5 py-1.5 font-mono text-[13px] outline-none focus:ring-2 focus:ring-accent-weak ${
              logicError ? "border-red focus:border-red" : "border-line-2 focus:border-accent"
            }`}
          />
          <p id={`${fieldId}-hint`} className="mt-1 text-xs text-muted">
            {LOGIC_HINT}
          </p>
          <div id={`${fieldId}-error`} aria-live="polite">
            {logicError && (
              <p className="mt-1 flex items-start gap-1 text-xs text-red">
                <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
                {logicError}
              </p>
            )}
          </div>
        </div>
      )}

      {problems.map((p, i) => (
        <p key={i} className="mt-2 text-xs text-red">
          {p}
        </p>
      ))}

      {hiddenByRepeats && (
        <p className="mt-2 text-xs text-muted">
          Some questions aren&apos;t listed because they&apos;re inside a repeating group this block isn&apos;t in.
        </p>
      )}
    </div>
  );
}

/**
 * Stored content as the editor holds it. Explicit fields, so a version saved
 * with `description: ""` starts clean too; conditions get their ids and logic
 * text (contract §15.6), and scores are brought to the saved shape as the API
 * does (§17.7–§17.9): text only, never a formula tree, which is what the
 * editor's dirty check and Cancel compare against.
 */
function editorContent(s: Partial<FormSchema> | undefined, fallbackTitle: string): FormSchema {
  return {
    title: s?.title || fallbackTitle,
    description: s?.description || undefined,
    settings: s?.settings,
    blocks: normalizeScores(normalizeConditions(s?.blocks ?? [])),
    navigation: s?.navigation,
    drafts: s?.drafts,
    templateRef: s?.templateRef,
  };
}

/**
 * The form editor. With `templateId` it edits a template instead ("template
 * mode"): the same canvas, inspector, save rules, Save and Cancel, but Save
 * writes to the template, and what only applies to a form — Download,
 * responses, publishing, AI — isn't offered. A group template is edited as a
 * form whose only root item is its group, and it can't gain more root items.
 */
export default function FormEditor({ templateId }: { templateId?: string }) {
  const params = useParams();
  // A form's id; in template mode the route's id is the template's, and isn't used as a form's.
  const id = String(params.id);
  const templateMode = templateId !== undefined;
  // The template being edited: its name, kind, and the version the edit started from.
  const [template, setTemplate] = useState<{ name: string; kind: TemplateKind; version: number; scope: TemplateScope } | null>(null);
  const groupTemplate = template?.kind === "group";
  // Viewers aren't offered "Save as template" (the API refuses it with 403 anyway).
  const canEdit = useCanEdit();
  // A template that can't be saved here: a system template, or anything for a viewer. No Save or Cancel.
  const readOnlyTemplate = templateMode && (template?.scope === "system" || !canEdit);

  const [schema, setSchema] = useState<FormSchema | null>(null);
  // The latest saved version's content: the baseline for dirty-state and Cancel.
  const [saved, setSaved] = useState<FormSchema | null>(null);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<FormStatus>("DRAFT");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // A message under the header; `blocks` are questions to offer "jump to" links for.
  // `info` notes are neutral (e.g. a setting switched for the author); the rest are refusals.
  const [notice, setNotice] = useState<{ text: string; blocks?: Block[]; tone?: "info" } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState<AiMsg[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [logicTips, setLogicTips] = useState<LogicSuggestion[] | null>(null);
  const [logicBusy, setLogicBusy] = useState(false);
  const [transLang, setTransLang] = useState("Spanish");
  const [transBusy, setTransBusy] = useState(false);
  const [transNote, setTransNote] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [menuAnchor, setMenuAnchor] = useState({ left: 0, top: 0 });
  // Where the insert menu puts the next block; null = decided by the selection.
  const [insertTarget, setInsertTarget] = useState<MoveTarget | null>(null);
  // Groups folded on the canvas. Editor-only state: never saved.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // The group whose delete dialog is open.
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  // The page whose delete dialog is open.
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
  // The "Your questions will move to Page 1" confirm is open.
  const [confirmPaging, setConfirmPaging] = useState(false);
  // The template picker is open; where "Insert as group" puts the copy.
  const [picking, setPicking] = useState<MoveTarget | null>(null);
  // The "Save as template" dialog is open, for the form or one group.
  const [savingAsTemplate, setSavingAsTemplate] = useState<{ kind: "form" } | { kind: "group"; groupId: string } | null>(null);
  // A drag in progress: the block, the row it's over, and how far it has moved sideways.
  const [drag, setDrag] = useState<{ activeId: string; overId: string; offsetX: number } | null>(null);
  const insertRowRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (templateId !== undefined) {
      getTemplate(templateId)
        .then((t) => {
          const latest = templateContent(t);
          setTemplate({ name: t.name, kind: t.kind, version: t.version, scope: t.scope });
          setSchema(latest);
          setSaved(latest);
          setSelectedId(latest.blocks[0]?.id ?? null);
          if (t.scope === "system") {
            setNotice({ tone: "info", text: "This is a system template, so it can't be changed. Duplicate it from Templates to make your own copy." });
          }
        })
        .catch(() => setLoadError(true));
      return;
    }
    getForm(id)
      .then((f) => {
        const s = f.versions[0]?.schema;
        const latest = editorContent(s, f.title);
        setSchema(latest);
        setSaved(latest);
        setSlug(f.slug);
        setStatus(f.status);
        setSelectedId(s?.blocks?.[0]?.id ?? null);
      })
      .catch(() => setLoadError(true));
  }, [id, templateId]);

  /** A template's content as the editor holds it: a group template as the only block of a form. */
  function templateContent(t: TemplateDetail): FormSchema {
    return editorContent(templateAsForm(t.kind, t.content) as FormSchema, GROUP_TEMPLATE_TITLE);
  }

  // Nothing is persisted until Save, so "dirty" = editor differs from the latest
  // saved version, compared the same key-order-insensitive way the API does.
  // A template that can't be saved here (`readOnlyTemplate`) is never dirty: there is nothing to lose by leaving.
  const dirty = useMemo(
    () => !readOnlyTemplate && !!schema && !!saved && !sameContent(schema, saved),
    [schema, saved, readOnlyTemplate],
  );

  // With no autosave, closing or reloading the tab would silently lose edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Guard the editor's in-app links: the App Router has no navigation-blocking API. */
  function confirmLeave(e: React.MouseEvent) {
    if (dirty && !confirm("Leave without saving? Your unsaved changes will be lost.")) {
      e.preventDefault();
    }
  }

  async function onSave() {
    if (!schema || !dirty || saving || readOnlyTemplate) return;
    // Baseline is what was sent, so edits made while the request is in flight stay dirty.
    const sent = schema;
    setSaving(true);
    setNotice(null);
    try {
      // The save fills empty option codes and trims labels (contract §13.3): adopt
      // what was stored, unless the author edited while the request was in flight.
      let stored: FormSchema;
      if (templateId !== undefined && template) {
        // The version the edit started from: a save made after someone else's is refused (409).
        const t = await updateTemplate(templateId, { content: templateFromForm(template.kind, sent), version: template.version });
        setTemplate({ name: t.name, kind: t.kind, version: t.version, scope: t.scope });
        stored = templateContent(t);
      } else {
        stored = (await saveSchema(id, sent)).schema;
      }
      setSaved(stored);
      setSchema((s) => (s === sent ? stored : s));
    } catch (e) {
      if (e instanceof ApiError && e.code === "NO_CHANGES") {
        // Identical to the current version: nothing to save. Its empty codes get
        // the codes the saved version has — the same rule, applied here.
        const filled = FormSchema.parse(sent);
        setSaved(filled);
        setSchema((s) => (s === sent ? filled : s));
      } else if (e instanceof ApiError && e.code === "VERSION_CONFLICT") {
        // Keep the unsaved edits; the author decides whether to reload.
        setNotice({ text: e.message });
      } else {
        setNotice({ text: `Couldn't save: ${(e as Error).message}` });
      }
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    if (!saved || !dirty) return;
    if (!confirm("Discard unsaved changes? This cannot be undone.")) return;
    setSchema(saved);
    setNotice(null);
  }

  async function onDownload() {
    setDownloading(true);
    try {
      await downloadArtifact(id); // latest saved version, never the unsaved editor state
    } catch (e) {
      setNotice({ text: `Couldn't download: ${(e as Error).message}` });
    } finally {
      setDownloading(false);
    }
  }

  const patch = (fn: (s: FormSchema) => FormSchema) =>
    setSchema((s) => (s ? fn(s) : s));

  async function onSuggestLogic() {
    if (!schema) return;
    setLogicBusy(true);
    try {
      setLogicTips((await suggestLogic(schema)).suggestions);
    } catch (e) {
      setLogicTips([{ when: "Error", then: (e as Error).message }]);
    } finally {
      setLogicBusy(false);
    }
  }

  async function onTranslate() {
    if (!schema) return;
    setTransBusy(true);
    setTransNote(null);
    try {
      const r = await translateForm(schema, transLang);
      if (r.translated) {
        setSchema(r.schema);
        setTransNote(`Translated to ${transLang}.`);
      } else {
        setTransNote(r.note || "Translation unavailable.");
      }
    } catch (e) {
      setTransNote((e as Error).message);
    } finally {
      setTransBusy(false);
    }
  }

  const openMenu = (anchor?: HTMLElement | null, target: MoveTarget | null = null) => {
    setInsertTarget(target);
    const r = (anchor ?? insertRowRef.current)?.getBoundingClientRect();
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

  /**
   * Where a new block goes when no explicit target was chosen: inside the
   * selected page or group (at its end), or just after the selected block in
   * its container, or at the end of the form — the end of the last page, in a
   * paged form, where nothing may sit outside a page.
   */
  function selectionInsertTarget(): MoveTarget {
    const entry = schema && selectedId ? findBlock(schema.blocks, selectedId) : undefined;
    if (!schema || !entry) {
      const last = schema?.blocks[schema.blocks.length - 1];
      if (last && isPage(last)) return { parentId: last.id, index: last.blocks.length };
      // A group template's only root item is its group: new blocks go inside it.
      if (groupTemplate && last && isGroup(last)) return { parentId: last.id, index: last.blocks.length };
      return { parentId: null, index: schema?.blocks.length ?? 0 };
    }
    if (isContainer(entry.block)) return { parentId: entry.block.id, index: entry.block.blocks.length };
    const parent = entry.ancestors[entry.ancestors.length - 1];
    return { parentId: parent?.id ?? null, index: entry.path[entry.path.length - 1] + 1 };
  }

  const expand = (...groupIds: string[]) =>
    setCollapsed((c) => {
      if (!groupIds.some((g) => c.has(g))) return c;
      const next = new Set(c);
      for (const g of groupIds) next.delete(g);
      return next;
    });

  const insertFromCatalog = (item: CatalogItem) => {
    if (!schema) return;
    if (item.template) {
      // The picker inserts where this block would have gone.
      setPicking(insertTarget ?? selectionInsertTarget());
      setMenuOpen(false);
      setMenuQuery("");
      setInsertTarget(null);
      return;
    }
    const taken = allBlockIds(schema.blocks);
    const b: Block =
      item.type === "group"
        ? newGroup(taken)
        : newBlock(item.type, item.level ? { level: item.level } : undefined, taken);
    const target = insertTarget ?? selectionInsertTarget();
    patch((s) => ({ ...s, blocks: insertBlockIntoTree(s.blocks, target.parentId, target.index, b) }));
    if (target.parentId) expand(target.parentId);
    setSelectedId(b.id);
    setMenuOpen(false);
    setMenuQuery("");
    setInsertTarget(null);
  };
  /** Why "Insert as page" isn't available in this form, or null when it is. */
  function insertAsPageRefusal(): string | null {
    if (!schema) return null;
    if (groupTemplate) return "A group template holds one group, so nothing can be inserted as a page.";
    return canInsertAsPage(schema.blocks) ? null : INSERT_AS_PAGE_UNAVAILABLE;
  }

  /**
   * Insert a group template's copy: fresh ids throughout, its conditions
   * following them, `templateRef` on the group. As a group, it goes where the
   * picker was opened; as a page, after the current page, in a form with pages
   * or an empty one (which then has pages). The usual ordering and prefix
   * guards apply, though a self-contained copy can't break either.
   */
  function insertTemplate(t: TemplateDetail, as: "group" | "page") {
    if (!schema || !picking) return;
    const source = { id: t.id, version: t.version, name: t.name, content: t.content as GroupBlock };
    const group = groupFromTemplate(source, allBlockIds(schema.blocks));
    let next: Block[];
    if (as === "page") {
      if (insertAsPageRefusal()) return;
      const page = pageForTemplateGroup(group, allBlockIds(schema.blocks));
      const after = currentPageId();
      next = after ? insertPageAfter(schema.blocks, after, page) : [page];
    } else {
      if (groupTemplate && picking.parentId === null) return;
      next = insertBlockIntoTree(schema.blocks, picking.parentId, picking.index, group);
    }
    setPicking(null);
    if (refuseStructureEdit(structureBreaks(schema.blocks, next), `insert "${t.name}" there`)) return;
    patch((s) => ({ ...s, blocks: next }));
    if (as === "group" && picking.parentId) expand(picking.parentId);
    setSelectedId(group.id);
    setNotice({ tone: "info", text: `Inserted a copy of "${t.name}".` });
  }

  /** A condition in words for the save-as-template list: `"Do you smoke?" is Yes`. */
  function quotedCondition(c: Condition): string {
    const source = schema ? findBlock(schema.blocks, c.question)?.block : undefined;
    const label = source ? conditionAnswerOptions(source)?.find((o) => o.code === c.answer)?.label : undefined;
    const answer = c.operator === "exists" ? "" : ` ${label ?? c.answer}`;
    return `${source ? `"${blockName(source)}"` : "a missing question"} ${OPERATOR_TEXT[c.operator]}${answer}`;
  }

  /** Select a block and bring it into view (used by the "jump to" links), opening any folded groups around it. */
  function jumpTo(bid: string) {
    const entry = schema ? findBlock(schema.blocks, bid) : undefined;
    if (entry) expand(...entry.ancestors.map((a) => a.id));
    setSelectedId(bid);
    // After the expanded groups have rendered.
    setTimeout(() => {
      document
        .querySelector(`[data-block-id="${bid.replace(/["\\]/g, "\\$&")}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
  }

  /*
   * Dependency guards: other blocks' conditions reference a source block by id,
   * by reading order (sources must come first) and by option code. These edits
   * would silently break those conditions, so they're refused, naming the
   * dependents — wherever in the tree they are. Option lists have their own
   * handlers below: a code change carries its conditions with it, and removing
   * an option a condition uses is refused.
   */
  const updateBlock = (bid: string, p: Partial<Block>) => {
    const current = schema ? findBlock(schema.blocks, bid)?.block : undefined;
    if (schema && current) {
      if (p.type && p.type !== current.type) {
        const deps = dependentsOf(schema.blocks, bid);
        if (deps.length) {
          setNotice({
            text: `Can't change the type of "${blockName(current)}" — these questions have conditions that depend on it:`,
            blocks: deps,
          });
          return;
        }
      }
    }
    patch((s) => ({
      ...s,
      blocks: updateBlockInTree(s.blocks, bid, (b) => ({ ...b, ...p }) as Block),
    }));
  };

  /*
   * Coded option lists (contract §13.3, §13.8). A code typed in the editor is
   * stored as typed, so its inline message shows; the conditions using the old
   * code follow it when the author leaves the field with a valid, unique code.
   * A code field left empty is regenerated from the label at once if a condition
   * uses the option (and the conditions follow); otherwise it stays empty until
   * the label is changed and its field left, or the save fills it. Until then
   * `codeOrigins` remembers the code they still use, by block, list and
   * position, so a detour through an empty, invalid or clashing code can't
   * strand them.
   *
   * A list is named by reference (`OptionListRef`): a block's options, a
   * matrix's columns, or a grid's rows, columns or one column's options. A
   * grid's columns go through these handlers for their code and label too, so
   * they behave exactly like options; every other field of a column is kept
   * (`withOptionList` refuses anything that isn't a column).
   */
  const codeOrigins = useRef(new Map<string, string>());
  const [codeStatus, setCodeStatus] = useState<{ blockId: string; ref: OptionListRef; text: string } | null>(null);
  const originKey = (bid: string, ref: OptionListRef, index: number) => `${bid}|${ref.list}|${ref.column ?? ""}|${index}`;
  // Only a block's own options can be condition answers; a matrix or a grid is never a source.
  const isSourceList = (ref: OptionListRef) => ref.list === "options" && ref.column === undefined;
  const listOf = (bid: string, ref: OptionListRef): Option[] => {
    const block = schema ? findBlock(schema.blocks, bid)?.block : undefined;
    return block ? [...optionListAt(block, ref)] : [];
  };
  const setList = (bid: string, ref: OptionListRef, options: Option[]) =>
    patch((s) => ({ ...s, blocks: updateBlockInTree(s.blocks, bid, (b) => withOptionList(b, ref, options)) }));
  const forgetOrigins = (bid: string) => {
    for (const key of [...codeOrigins.current.keys()]) if (key.startsWith(`${bid}|`)) codeOrigins.current.delete(key);
  };
  const optionHandlers = (bid: string, ref: OptionListRef, noun: "Option" | "Column" | "Row") => {
    /**
     * Store option `i`'s new, non-empty code — typed, or generated on leaving the
     * label. A valid, unique code takes the conditions with it, from the code they
     * still use; otherwise the inline message explains and they wait for a fix.
     */
    const commitCode = (options: Option[], i: number) => {
      if (!schema) return;
      const key = originKey(bid, ref, i);
      const to = options[i].code;
      const from = codeOrigins.current.get(key) ?? to;
      const unique = !options.some((o, k) => k !== i && o.code.trim().toLowerCase() === to.toLowerCase());
      if (!CODE_PATTERN.test(to) || !unique) {
        setList(bid, ref, options); // conditions keep `from`
        return;
      }
      codeOrigins.current.delete(key);
      const withList = updateBlockInTree(schema.blocks, bid, (b) => withOptionList(b, ref, options));
      const { blocks, updated } =
        isSourceList(ref) ? renameOptionCode(withList, bid, from, to) : { blocks: withList, updated: 0 };
      patch((s) => ({ ...s, blocks }));
      if (updated) {
        setCodeStatus({
          blockId: bid,
          ref,
          text: `${updated} ${updated === 1 ? "condition" : "conditions"} updated to use "${to}".`,
        });
      }
    };
    return {
      onLabel: (i: number, label: string) => {
        const options = listOf(bid, ref);
        options[i] = { ...options[i], label };
        setList(bid, ref, options);
      },
      // Leaving the label field after changing it fills an empty code from it (the row
      // calls this only then); an existing code never changes.
      onLabelLeave: (i: number) => {
        const options = listOf(bid, ref);
        if (options[i] && !options[i].code.trim()) commitCode(fillCodeAt(options, i), i);
      },
      onCodeFocus: (i: number) => {
        const key = originKey(bid, ref, i);
        if (!codeOrigins.current.has(key)) codeOrigins.current.set(key, listOf(bid, ref)[i]?.code.trim() ?? "");
      },
      onCode: (i: number, code: string) => {
        const options = listOf(bid, ref);
        options[i] = { ...options[i], code };
        setList(bid, ref, options);
      },
      onCodeLeave: (i: number) => {
        const options = listOf(bid, ref);
        if (!options[i]) return;
        options[i] = { ...options[i], code: options[i].code.trim() };
        if (!options[i].code) {
          // Left empty while a condition uses the option: regenerate it from the current
          // label straight away, and the conditions follow, so none points at a code that
          // no longer exists (contract §13.3). Otherwise it stays empty: the code comes from
          // the label the author types, or from the save — never from a placeholder.
          const inUse = codeOrigins.current.get(originKey(bid, ref, i));
          const used = isSourceList(ref) && !!inUse && !!schema && dependentsOf(schema.blocks, bid, (c) => c.answer === inUse).length > 0;
          if (used) commitCode(fillCodeAt(options, i), i);
          else setList(bid, ref, options);
          return;
        }
        commitCode(options, i);
      },
      // Refused while a condition uses the option's code — the one the conditions still hold.
      onRemove: (i: number) => {
        if (!schema) return;
        const options = listOf(bid, ref);
        const option = options[i];
        if (!option) return;
        const inUse = codeOrigins.current.get(originKey(bid, ref, i)) ?? option.code.trim();
        const deps = isSourceList(ref) && inUse ? dependentsOf(schema.blocks, bid, (c) => c.answer === inUse) : [];
        if (deps.length) {
          setNotice({
            text: `Can't remove "${option.label}" — these blocks have conditions that use it:`,
            blocks: deps,
          });
          return;
        }
        forgetOrigins(bid);
        setList(bid, ref, options.filter((_, k) => k !== i));
      },
      onAdd: () => {
        const options = listOf(bid, ref);
        setList(bid, ref, [...options, ...placeholderOptions(noun, 1, options)]);
      },
    };
  };

  /*
   * Import from a file (contract §13.9). The file is read here, in the browser,
   * and never sent anywhere; the preview dialog shows every row before anything
   * changes, and nothing is stored until Save.
   */
  const [importing, setImporting] = useState<{
    blockId: string;
    ref: OptionListRef;
    plural: string;
    /** A grid column, for the dialog's title: `column 2 ("Frequency")`. */
    owner?: string;
    fileName: string;
    parsed: ParsedImport;
    /** The list when the file was chosen; it can't change while the preview is open. */
    existing: Option[];
  } | null>(null);
  async function readImportFile(bid: string, ref: OptionListRef, plural: string, file: File, owner?: string) {
    const kind = file.name.toLowerCase().match(/\.(csv|txt)$/)?.[1] as "csv" | "txt" | undefined;
    if (!kind) {
      setNotice({ text: `Choose a .csv or .txt file — "${file.name}" isn't one.` });
      return;
    }
    const text = await file.text(); // UTF-8; a leading byte-order mark is dropped by the parser
    setImporting({ blockId: bid, ref, plural, owner, fileName: file.name, parsed: parseOptionFile(text, kind), existing: listOf(bid, ref) });
  }
  function applyImportedOptions(mode: ImportMode, preview: ImportPreviewRow[]) {
    if (!importing || !schema) return;
    const { blockId: bid, ref, plural, existing } = importing;
    const next = applyImport(existing, preview, mode);
    setImporting(null);
    // Replacing a source's options can't drop a code a condition uses; codes in the file keep theirs.
    const deps =
      mode === "replace" && isSourceList(ref) ? replaceBlockers(schema.blocks, bid, next.map((o) => o.code)) : [];
    if (deps.length) {
      setNotice({
        text: `Can't replace the ${plural} — these blocks have conditions that use a code that isn't in the file:`,
        blocks: deps,
      });
      return;
    }
    forgetOrigins(bid);
    setList(bid, ref, next);
    setCodeStatus({
      blockId: bid,
      ref,
      text:
        mode === "add"
          ? `Added ${preview.length} ${preview.length === 1 ? plural.replace(/s$/, "") : plural} from the file.`
          : `Replaced the ${plural} with ${preview.length} from the file.`,
    });
  }

  /*
   * A grid's columns (contract §14.6). Their code, label and removal go through
   * `optionHandlers` like any coded list; adding, moving, the type and Required
   * are here. Each uses the shared column helpers, which keep every other
   * column, and every other field of the edited one, as it was.
   */
  const updateColumns = (bid: string, edit: (columns: GridColumn[]) => GridColumn[]) =>
    patch((s) => ({
      ...s,
      blocks: updateBlockInTree(s.blocks, bid, (b) => (isGrid(b) ? { ...b, columns: edit(b.columns ?? []) } : b)),
    }));
  const columnHandlers = (bid: string) => ({
    onAdd: () => updateColumns(bid, addGridColumn),
    onMove: (i: number, direction: -1 | 1) => {
      forgetOrigins(bid); // remembered codes are by position
      updateColumns(bid, (columns) => moveGridColumn(columns, i, direction));
    },
    onRequired: (i: number, required: boolean) =>
      updateColumns(bid, (columns) => updateGridColumn(columns, i, { required: required ? true : undefined })),
    // A choice column turned into text loses its options, so that is asked first; Cancel changes nothing.
    onType: (i: number, type: GridColumnType) => {
      const block = schema ? findBlock(schema.blocks, bid)?.block : undefined;
      const column = block && isGrid(block) ? block.columns?.[i] : undefined;
      if (!column) return;
      const warning = columnTypeChangeWarning(column, i, type);
      if (warning && !window.confirm(warning)) return;
      forgetOrigins(bid);
      updateColumns(bid, (columns) => columns.map((c, k) => (k === i ? withColumnType(c, type) : c)));
    },
  });

  /** For the condition editor: the code of option `index` of `sourceId`, generated first if empty. */
  function pickAnswer(sourceId: string, index: number): string {
    if (!schema) return "";
    const { code } = answerCode(schema.blocks, sourceId, index);
    patch((s) => ({ ...s, blocks: answerCode(s.blocks, sourceId, index).blocks }));
    return code;
  }

  /** Delete a question or layout block. A page or group opens its two-choice dialog instead. */
  /**
   * A group template's only root item is its group (template mode): it can't be
   * deleted or moved, and nothing can be moved beside it. True, with the reason
   * shown, when an edit would do that.
   */
  function refuseRootChange(bid: string | null, target?: MoveTarget): boolean {
    if (!groupTemplate || !schema) return false;
    const root = schema.blocks[0];
    if (bid !== root?.id && target?.parentId !== null) return false;
    setNotice({ text: "A group template holds exactly one group: it stays, and everything else goes inside it." });
    return true;
  }

  const removeBlock = (bid: string) => {
    if (!schema) return;
    const current = findBlock(schema.blocks, bid)?.block;
    if (!current) return;
    if (refuseRootChange(bid)) return;
    if (isPage(current)) {
      setDeletingPageId(bid);
      return;
    }
    if (isGroup(current)) {
      setDeletingGroupId(bid);
      return;
    }
    const deps = deletionBlockers(schema.blocks, bid);
    if (deps.length) {
      setNotice({
        text: `Can't delete "${blockName(current)}" — these questions have conditions that depend on it:`,
        blocks: deps,
      });
      return;
    }
    patch((s) => ({ ...s, blocks: removeBlockFromTree(s.blocks, bid) }));
    setSelectedId((cur) => (cur === bid ? null : cur));
  };

  /** Delete a group but keep its contents where it was. Its own conditions go with it. */
  function deleteGroupKeepingContents(gid: string) {
    if (!schema) return;
    setDeletingGroupId(null);
    if (refuseRootChange(gid)) return;
    const next = unwrapGroup(schema.blocks, gid);
    // Unwrapping changes neither reading order nor which repeats enclose a block, but it
    // goes through the same guard as any move.
    if (refuseStructureEdit(structureBreaks(schema.blocks, next), "remove that group")) return;
    patch((s) => ({ ...s, blocks: unwrapGroup(s.blocks, gid) }));
    setSelectedId((cur) => (cur === gid ? null : cur));
  }

  /** Delete a group and everything in it — refused while anything outside depends on something inside. */
  function deleteGroupWithContents(gid: string) {
    if (!schema) return;
    setDeletingGroupId(null);
    if (refuseRootChange(gid)) return;
    const group = findBlock(schema.blocks, gid)?.block;
    const deps = deletionBlockers(schema.blocks, gid);
    if (deps.length) {
      setNotice({
        text: `Can't delete "${group ? blockName(group) : "the group"}" and its questions — these questions outside it have conditions that depend on something inside it:`,
        blocks: deps,
      });
      return;
    }
    patch((s) => ({ ...s, blocks: removeBlockFromTree(s.blocks, gid) }));
    setSelectedId(null);
  }

  /**
   * Refuse a change to the tree's structure that would break conditions
   * (`structureBreaks`), naming the blocks it would break. `action` completes
   * "Can't …". Returns true when refused.
   */
  function refuseStructureEdit(breaks: { order: Block[]; prefix: Block[] }, action: string): boolean {
    if (breaks.order.length) {
      setNotice({
        text: `Can't ${action} — these questions would end up before a question their conditions depend on:`,
        blocks: breaks.order,
      });
      return true;
    }
    if (breaks.prefix.length) {
      setNotice({
        text: `Can't ${action} — these blocks would have conditions on a question inside a repeating group they aren't in:`,
        blocks: breaks.prefix,
      });
      return true;
    }
    return false;
  }

  /**
   * Every move — drag, the arrow buttons, "Move to group…" — comes through here.
   * A group moves with everything inside it. Refused if afterwards any condition
   * in the form would use a question that no longer comes before it, or one
   * inside a repeating group the dependent isn't in — into, out of or between
   * repeats (contract §12.8).
   */
  function tryMove(bid: string, target: MoveTarget) {
    if (!schema) return;
    if (refuseRootChange(bid, target)) return;
    const moving = findBlock(schema.blocks, bid)?.block;
    if (!moving) return;
    let next: Block[];
    try {
      next = moveBlockInTree(schema.blocks, bid, target.parentId, target.index);
    } catch (e) {
      setNotice({ text: (e as Error).message });
      return;
    }
    if (refuseStructureEdit(structureBreaks(schema.blocks, next), `move "${blockName(moving)}" there`)) return;
    if (target.parentId) expand(target.parentId);
    patch((s) => ({ ...s, blocks: next }));
  }

  /**
   * The group inspector's "Repeats" toggle (contract §12.8). Turning it on writes
   * the defaults, and is refused while a condition outside the group uses a
   * question inside it. Turning it off is always allowed and clears the settings,
   * so turning it on again starts from the defaults.
   */
  function setRepeats(gid: string, on: boolean) {
    if (!schema) return;
    const group = findBlock(schema.blocks, gid)?.block;
    if (!group || !isGroup(group)) return;
    if (on) {
      const deps = repeatsOnBlockers(schema.blocks, gid);
      if (deps.length) {
        setNotice({
          text: `Can't make "${blockName(group)}" repeat — these blocks outside it have conditions that use a question inside it:`,
          blocks: deps,
        });
        return;
      }
      updateBlock(gid, { repeats: true, ...REPEAT_DEFAULTS, maxOccurs: undefined });
    } else {
      updateBlock(gid, { repeats: undefined, repeatLabel: undefined, minOccurs: undefined, maxOccurs: undefined });
    }
  }

  /*
   * Pages. The edits themselves, and their refusals, live in form-schema; a
   * refusal shows in the standard banner with links to the blocks in the way.
   */
  function applyPageEdit(edit: PageEdit): boolean {
    if (!edit.ok) {
      setNotice({ text: edit.message, blocks: edit.dependents.length ? edit.dependents : undefined });
      return false;
    }
    patch((s) => ({ ...s, blocks: edit.blocks }));
    return true;
  }

  /** The page holding the selection, or the selected page; else the last page. */
  function currentPageId(): string | null {
    if (!schema) return null;
    const entry = selectedId ? findBlock(schema.blocks, selectedId) : undefined;
    if (entry && isPage(entry.block)) return entry.block.id;
    if (entry?.ancestors[0] && isPage(entry.ancestors[0])) return entry.ancestors[0].id;
    const pages = schema.blocks.filter(isPage);
    return pages[pages.length - 1]?.id ?? null;
  }

  /** "Add page": after the current page — or, on a form without pages, convert it first. */
  function addPage() {
    if (!schema) return;
    if (!isPaged(schema.blocks)) {
      if (schema.blocks.length) setConfirmPaging(true);
      else convertToPages(); // nothing to move, so nothing to confirm
      return;
    }
    const after = currentPageId();
    if (!after) return;
    const page = newPage(allBlockIds(schema.blocks));
    patch((s) => ({ ...s, blocks: insertPageAfter(s.blocks, after, page) }));
    setSelectedId(page.id);
  }

  /** Wrap everything into Page 1 and add an empty Page 2 after it. */
  function convertToPages() {
    if (!schema) return;
    setConfirmPaging(false);
    const wrapped = makePaged(schema.blocks);
    const second = newPage(allBlockIds(wrapped));
    patch((s) => ({ ...s, blocks: insertPageAfter(wrapped, wrapped[0].id, second) }));
    setSelectedId(second.id);
  }

  function movePageBy(pageId: string, direction: -1 | 1) {
    if (schema) applyPageEdit(movePage(schema.blocks, pageId, direction));
  }

  function deletePageKeeping(pageId: string) {
    if (!schema) return;
    setDeletingPageId(null);
    if (applyPageEdit(deletePageKeepingContents(schema.blocks, pageId))) {
      setSelectedId((cur) => (cur === pageId ? null : cur));
    }
  }

  function deletePageAll(pageId: string) {
    if (!schema) return;
    setDeletingPageId(null);
    if (applyPageEdit(deletePageWithContents(schema.blocks, pageId))) setSelectedId(null);
  }

  /** "Remove pages": only offered with one page left; its contents become the form. */
  function removePages() {
    if (!schema) return;
    const blocks = removePaging(schema.blocks);
    // "On the app's server" needs pages (drafts contract §2): switch back, and say so.
    const mode = schema.drafts?.mode ?? DEFAULT_DRAFT_MODE;
    const switchDrafts = !draftModeAvailable(mode, blocks);
    patch((s) => ({ ...s, blocks, ...(switchDrafts ? { drafts: undefined } : {}) }));
    setSelectedId(null);
    if (switchDrafts) {
      setNotice({
        tone: "info",
        text: "Saving progress on the server needs pages, so it's been switched to 'Only while the form is open'.",
      });
    }
  }

  /** The default mode isn't stored, as with navigation. */
  const updateDrafts = (mode: DraftMode) =>
    patch((s) => ({ ...s, drafts: draftsWithoutDefault({ mode }) }));

  /** Values equal to the default aren't stored, so toggling back leaves the form unchanged. */
  const updateNavigation = (p: Navigation) =>
    patch((s) => ({ ...s, navigation: navigationWithoutDefaults({ ...s.navigation, ...p }) }));
  const showProgress = schema?.navigation?.showProgress ?? NAVIGATION_DEFAULTS.showProgress;
  const progressStyle = schema?.navigation?.progressStyle ?? NAVIGATION_DEFAULTS.progressStyle;

  const updateSettings = (p: {
    submitLabel?: string;
    redirectUrl?: string;
    spamProtection?: boolean;
    partialSubmissions?: boolean;
    notifyEmails?: string[];
  }) => patch((s) => ({ ...s, settings: { ...s.settings, ...p } }));
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

  /* Dragging: one flat list of the visible rows; sideways movement sets depth. */
  const dragItems = (activeId: string | null) =>
    schema ? flattenVisible(schema.blocks, collapsed, activeId) : [];

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setDrag({ activeId: id, overId: id, offsetX: 0 });
  }
  function onDragMove(e: DragMoveEvent) {
    setDrag((d) => (d ? { ...d, offsetX: e.delta.x } : d));
  }
  function onDragOver(e: DragOverEvent) {
    const over = e.over;
    if (over) setDrag((d) => (d ? { ...d, overId: String(over.id) } : d));
  }
  function onDragEnd(e: DragEndEvent) {
    setDrag(null);
    if (!e.over || !schema) return;
    const activeId = String(e.active.id);
    const projection = getProjection(dragItems(activeId), activeId, String(e.over.id), e.delta.x, DRAG_INDENT);
    if (!projection) return;
    const entry = findBlock(schema.blocks, activeId);
    const currentParent = entry?.ancestors[entry.ancestors.length - 1]?.id ?? null;
    const currentIndex = entry ? entry.path[entry.path.length - 1] : -1;
    if (projection.parentId === currentParent && projection.index === currentIndex) return; // dropped in place
    tryMove(activeId, { parentId: projection.parentId, index: projection.index });
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
        {loadError ? (templateMode ? "Couldn't load this template." : "Couldn't load this form.") : <Loader2 className="h-5 w-5 animate-spin" />}
      </div>
    );

  const selectedEntry = selectedId ? findBlock(schema.blocks, selectedId) : undefined;
  const selected = selectedEntry?.block ?? null;
  // The same rule and message as the save (displayBlockProblem in form-schema).
  const selectedDisplayProblem = selectedEntry ? (displayBlockProblem(selectedEntry)?.message ?? null) : null;
  // A repeating group's settings: the save's rules and messages (repeatSettingsProblems), each under its field.
  const selectedRepeatProblems = selected ? repeatSettingsProblems(selected) : [];
  const repeatProblem = (field: "repeatLabel" | "minOccurs" | "maxOccurs") =>
    selectedRepeatProblems.find((p) => p.field === field)?.detail;
  const numbers = questionNumbers(schema.blocks);
  /** The polite status line for one list: "2 conditions updated…", "Added 3 rows from the file." */
  const listStatus = (bid: string, ref: OptionListRef) =>
    codeStatus?.blockId === bid && sameOptionList(codeStatus.ref, ref) ? codeStatus.text : null;
  // While a group is dragged, its contents travel with it as one row.
  const rows = flattenVisible(schema.blocks, collapsed, drag?.activeId ?? null);
  const projection = drag
    ? getProjection(rows, drag.activeId, drag.overId, drag.offsetX, DRAG_INDENT)
    : null;
  const deletingGroup = deletingGroupId ? findBlock(schema.blocks, deletingGroupId)?.block : undefined;
  const deletingPage = deletingPageId ? findBlock(schema.blocks, deletingPageId)?.block : undefined;
  const autoTarget = selectionInsertTarget();
  const autoTargetGroup = autoTarget.parentId ? findBlock(schema.blocks, autoTarget.parentId)?.block : undefined;
  const paged = isPaged(schema.blocks);
  const pages = schema.blocks.filter(isPage);
  const pageNumbers = new Map(pages.map((pg, i) => [pg.id, i + 1]));
  const addPageAfter = paged ? pages.find((pg) => pg.id === currentPageId()) : undefined;

  // Where a drop would land: before one of the target's visible children, or at its end.
  let dropBefore: string | null = null;
  let dropAtEndOfGroup: string | null = null; // a page's or group's id
  let dropAtEndOfForm = false;
  if (drag && projection) {
    const siblings = rows.filter((r) => r.parentId === projection.parentId && r.id !== drag.activeId);
    if (projection.index < siblings.length) dropBefore = siblings[projection.index].id;
    else if (projection.parentId) dropAtEndOfGroup = projection.parentId;
    else dropAtEndOfForm = true;
  }

  /**
   * The canvas as nested boxes, built from the flat row list with a stack of
   * open pages and groups: each page or group box holds its header, its
   * contents and an "Add to" row.
   */
  function canvasTree() {
    const card = (item: FlatItem) => {
      // In a group template, a step that would leave the group isn't offered.
      const allowed = (t: MoveTarget | null) => (groupTemplate && t?.parentId === null ? null : t);
      const step = { up: allowed(stepMove(schema!.blocks, item.id, -1)), down: allowed(stepMove(schema!.blocks, item.id, 1)) };
      return (
        <CanvasCard
          key={item.id}
          item={item}
          number={numbers.get(item.id)}
          selected={item.id === selectedId}
          canMoveUp={!!step.up}
          canMoveDown={!!step.down}
          dropLine={!item.isContainer && dropBefore === item.id ? "top" : undefined}
          onSelect={() => setSelectedId(item.id)}
          onDelete={() => removeBlock(item.id)}
          onMove={(direction) => {
            const target = direction === -1 ? step.up : step.down;
            if (target) tryMove(item.id, target);
          }}
          onToggle={() => toggle(item.id)}
          menu={
            !templateMode && canEdit && isGroup(item.block)
              ? [
                  {
                    label: "Save as template…",
                    icon: LayoutTemplate,
                    onSelect: () => setSavingAsTemplate({ kind: "group", groupId: item.id }),
                  },
                ]
              : undefined
          }
          locked={groupTemplate && item.id === schema!.blocks[0]?.id}
        />
      );
    };
    type Frame = { item: FlatItem | null; children: React.ReactNode[] };
    const stack: Frame[] = [{ item: null, children: [] }];
    const toggle = (cid: string) =>
      setCollapsed((c) => {
        const next = new Set(c);
        if (next.has(cid)) next.delete(cid);
        else next.add(cid);
        return next;
      });
    const close = () => {
      const { item, children } = stack.pop()!;
      const c = item!.block as ContainerBlock;
      // Collapsed, or being dragged: a single closed box.
      const open = !item!.collapsed && item!.id !== drag?.activeId;
      const contents = open
        ? [
            ...children,
            <ContainerEnd
              key={`end-${c.id}`}
              container={c}
              dropLine={dropAtEndOfGroup === c.id}
              onAdd={(anchor) => openMenu(anchor, { parentId: c.id, index: c.blocks.length })}
            />,
          ]
        : null;
      const dropTarget = !!drag && projection?.parentId === c.id;
      if (isPage(c)) {
        const at = schema!.blocks.indexOf(c);
        stack[stack.length - 1].children.push(
          <PageBox
            key={c.id}
            item={item!}
            pageNumber={pageNumbers.get(c.id) ?? at + 1}
            selected={c.id === selectedId}
            dropTarget={dropTarget}
            canMoveUp={at > 0}
            canMoveDown={at < schema!.blocks.length - 1}
            onlyPage={pages.length === 1}
            onSelect={() => setSelectedId(c.id)}
            onTitle={(title) => updateBlock(c.id, { title })}
            onToggle={() => toggle(c.id)}
            onMove={(direction) => movePageBy(c.id, direction)}
            onDelete={() => removeBlock(c.id)}
            onRemovePages={removePages}
          >
            {contents}
          </PageBox>,
        );
        return;
      }
      stack[stack.length - 1].children.push(
        <GroupBox
          key={c.id}
          group={c}
          level={item!.level}
          selected={c.id === selectedId}
          dropTarget={dropTarget}
          dimmed={drag?.activeId === c.id}
          dropLine={dropBefore === c.id ? "top" : undefined}
          header={card(item!)}
        >
          {contents}
        </GroupBox>,
      );
    };
    for (const item of rows) {
      while (stack.length > 1 && stack[stack.length - 1].item!.depth >= item.depth) close();
      if (item.isContainer) stack.push({ item, children: [] });
      else stack[stack.length - 1].children.push(card(item));
    }
    while (stack.length > 1) close();
    return stack[0].children;
  }
  const draggedBlock = drag ? findBlock(schema.blocks, drag.activeId)?.block : undefined;
  const fieldCls =
    "w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-weak";

  return (
    <div className="flex h-screen flex-col bg-bg">
      {/* Top bar */}
      <header className="flex h-14 flex-none items-center gap-3 border-b border-line bg-surface px-4">
        <Link
          href={templateMode ? "/app/templates" : "/app"}
          onClick={confirmLeave}
          className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-2 hover:bg-surface-3"
          aria-label={templateMode ? "Back to templates" : "Back"}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {templateMode ? (
          <h1 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
            <LayoutTemplate className="h-4 w-4 flex-none text-accent-2" aria-hidden="true" />
            <span className="truncate">Template: {template?.name}</span>
            <span className="flex-none rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
              {groupTemplate ? "Group" : "Form"}
            </span>
          </h1>
        ) : (
          <input
            value={schema.title}
            onChange={(e) => patch((s) => ({ ...s, title: e.target.value }))}
            aria-label="Form title"
            className="min-w-0 max-w-[280px] flex-none rounded-md px-2 py-1 text-[15px] font-semibold tracking-tight outline-none hover:bg-surface-3 focus:bg-surface-3"
            spellCheck={false}
          />
        )}
        <span className="flex items-center gap-1.5 text-xs text-faint">
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </>
          ) : dirty ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-amber" /> Unsaved changes
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-green" /> All changes saved
            </>
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!templateMode && (
            <>
              <Link href={`/app/forms/${id}/responses`} onClick={confirmLeave} className="btn btn-ghost btn-sm">
                <Inbox className="h-4 w-4" /> Responses
              </Link>
              <Link href={`/app/forms/${id}/analytics`} onClick={confirmLeave} className="btn btn-ghost btn-sm">
                <BarChart3 className="h-4 w-4" /> Analytics
              </Link>
              <Link href={`/app/forms/${id}/integrations`} onClick={confirmLeave} className="btn btn-ghost btn-sm">
                <Zap className="h-4 w-4" /> Connect
              </Link>
              <button
                onClick={() => setAiOpen((v) => !v)}
                className={`btn btn-sm ${aiOpen ? "btn-primary" : "btn-outline"}`}
              >
                <Sparkles className="h-4 w-4" /> Ask AI
              </button>
              {status === "PUBLISHED" && (
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
              )}
              <button
                onClick={onDownload}
                className="btn btn-outline btn-sm"
                title="Download the latest saved version"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download
              </button>
              {canEdit && (
                <MenuButton
                  label="More form actions"
                  className="btn btn-outline btn-sm px-2"
                  items={[{ label: "Save form as template…", icon: LayoutTemplate, onSelect: () => setSavingAsTemplate({ kind: "form" }) }]}
                />
              )}
            </>
          )}
          {!readOnlyTemplate && (
            <>
              <button onClick={onCancel} disabled={!dirty || saving} className="btn btn-outline btn-sm">
                Cancel
              </button>
              <button onClick={onSave} disabled={!dirty || saving} className="btn btn-primary btn-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </>
          )}
        </div>
      </header>

      {deletingGroup && isGroup(deletingGroup) && (
        <DeleteGroupDialog
          group={deletingGroup}
          blocks={schema.blocks}
          onKeep={() => deleteGroupKeepingContents(deletingGroup.id)}
          onDeleteAll={() => deleteGroupWithContents(deletingGroup.id)}
          onClose={() => setDeletingGroupId(null)}
        />
      )}

      {deletingPage && isPage(deletingPage) && (
        <DeletePageDialog
          page={deletingPage}
          blocks={schema.blocks}
          onKeep={() => deletePageKeeping(deletingPage.id)}
          onDeleteAll={() => deletePageAll(deletingPage.id)}
          onClose={() => setDeletingPageId(null)}
        />
      )}
      {confirmPaging && <PagingDialog onConfirm={convertToPages} onClose={() => setConfirmPaging(false)} />}
      {picking && <TemplatePicker asPage={insertAsPageRefusal()} onInsert={insertTemplate} onClose={() => setPicking(null)} />}
      {savingAsTemplate && (
        <SaveTemplateDialog
          kind={savingAsTemplate.kind}
          form={schema}
          groupId={savingAsTemplate.kind === "group" ? savingAsTemplate.groupId : undefined}
          phrase={quotedCondition}
          onClose={() => setSavingAsTemplate(null)}
          onSaved={(t) => {
            setSavingAsTemplate(null);
            setNotice({ tone: "info", text: `Saved "${t.name}" to your organisation's templates.` });
          }}
        />
      )}
      {importing && (
        <OptionImportDialog
          fileName={importing.fileName}
          plural={importing.plural}
          owner={importing.owner}
          parsed={importing.parsed}
          existing={importing.existing}
          onApply={applyImportedOptions}
          onClose={() => setImporting(null)}
        />
      )}

      {notice && (
        <div
          role={notice.tone === "info" ? "status" : "alert"}
          className={`flex flex-none items-center gap-3 border-b px-4 py-2 text-sm ${
            notice.tone === "info"
              ? "border-[#EAD9AE] bg-[#FBF0D9] text-ink-2"
              : "border-[#F5C2C2] bg-[#FCECEC] text-red"
          }`}
        >
          <span className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {notice.text}
            {notice.blocks?.map((b) => (
              <button
                key={b.id}
                onClick={() => jumpTo(b.id)}
                className="rounded-md border border-[#F5C2C2] bg-white px-2 py-0.5 text-xs font-medium text-ink-2 hover:border-red"
              >
                {blockName(b)} →
              </button>
            ))}
          </span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px]">
        {/* Canvas */}
        <div className="overflow-auto bg-bg px-6 py-8">
          <div className="mx-auto max-w-[680px]">
            <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
              {groupTemplate ? (
                // A group template has no title or description of its own: it is its group.
                <p className="text-sm text-muted">
                  This group template is the group below. Everything in it goes inside the group.
                </p>
              ) : (
                <>
                  <input
                    value={schema.title}
                    onChange={(e) => patch((s) => ({ ...s, title: e.target.value }))}
                    onFocus={() => setSelectedId(null)}
                    aria-label={templateMode ? "Form title (in forms made from this template)" : "Form title"}
                    className="w-full text-[26px] font-bold tracking-tight outline-none"
                    spellCheck={false}
                  />
                  <input
                    value={schema.description ?? ""}
                    // A cleared description is "no description", not "" — otherwise typing
                    // then deleting would count as an unsaved change.
                    onChange={(e) => patch((s) => ({ ...s, description: e.target.value || undefined }))}
                    onFocus={() => setSelectedId(null)}
                    placeholder="Add a description…"
                    aria-label="Form description"
                    className="mt-1.5 w-full text-[14.5px] text-muted outline-none"
                    spellCheck={false}
                  />
                </>
              )}

              <div className="mt-6">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  // A dragged group's contents are folded away, so re-measure as the layout changes.
                  measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                  onDragStart={onDragStart}
                  onDragMove={onDragMove}
                  onDragOver={onDragOver}
                  onDragEnd={onDragEnd}
                  onDragCancel={() => setDrag(null)}
                >
                  <SortableContext items={rows.map((r) => r.id)} strategy={noDisplacement}>
                    <div className="relative flex flex-col gap-2.5">
                      {canvasTree()}
                      {dropAtEndOfForm && <DropLine at="bottom" />}
                    </div>
                  </SortableContext>
                  <DragOverlay dropAnimation={null}>
                    {draggedBlock && <DragGhost block={draggedBlock} />}
                  </DragOverlay>
                </DndContext>
              </div>

              {/* Notion-style slash inserter */}
              <div ref={insertRowRef} className="mt-3 flex items-center gap-2 rounded-lg px-1 py-1">
                <button
                  onClick={() => openMenu()}
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
                  placeholder={
                    autoTargetGroup
                      ? `Type / to add a block to "${
                          blockName(autoTargetGroup).trim() || (isPage(autoTargetGroup) ? "this page" : "this group")
                        }", or click +`
                      : "Type / to insert a block, or click +"
                  }
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
                  spellCheck={false}
                />
              </div>

              {!groupTemplate && (
                <button
                  onClick={addPage}
                  className="mt-2 flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-muted hover:text-accent-2"
                >
                  <FileText className="h-4 w-4" />
                  {addPageAfter ? `Add page after "${addPageAfter.title.trim() || "Untitled page"}"` : "Add page"}
                </button>
              )}

              {schema.blocks.length === 0 && (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-2 py-10 text-center">
                  <span className="text-sm font-medium text-ink">Add your first block</span>
                  <span className="text-sm text-muted">
                    Type <kbd className="rounded border border-line-2 bg-surface-2 px-1.5 font-mono text-xs">/</kbd>{" "}
                    above or click + to choose from {CATALOG.reduce((n, g) => n + g.items.filter((it) => !it.template).length, 0)} block types.
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
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">
                {inspectorHeading(selected)}
              </h4>
              <label htmlFor="block-label" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                {isPage(selected) ? "Title" : "Label"}
              </label>
              <input
                id="block-label"
                value={blockName(selected)}
                onChange={(e) =>
                  updateBlock(selected.id, isPage(selected) ? { title: e.target.value } : { label: e.target.value })
                }
                className={`${fieldCls} ${["image", "video", "audio"].includes(selected.type) ? "mb-1.5" : "mb-3"}`}
              />
              {selected.type === "image" && (
                <p className="mb-3 text-xs text-muted">
                  Also read aloud to screen-reader users — describe what the image shows.
                </p>
              )}
              {selected.type === "video" && (
                <p className="mb-3 text-xs text-muted">
                  Read aloud to screen-reader users — describe what the video is about.
                </p>
              )}
              {selected.type === "audio" && (
                <p className="mb-3 text-xs text-muted">
                  Read aloud to screen-reader users — say what the recording is.
                </p>
              )}

              {/* Repeating groups (contract §12): groups only, never pages. */}
              {isGroup(selected) && (
                <div className="mb-4 border-t border-line pt-3">
                  <div className="flex items-center justify-between text-[13.5px]">
                    <span id="repeats-label">Repeats</span>
                    <Switch
                      checked={!!selected.repeats}
                      aria-labelledby="repeats-label"
                      aria-describedby="repeats-help"
                      onChange={(on) => setRepeats(selected.id, on)}
                    />
                  </div>
                  <p id="repeats-help" className="mt-1 text-xs text-muted">
                    Respondents fill this group&apos;s questions once per entry, and can add and remove entries.
                  </p>

                  {isRepeatingGroup(selected) && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div>
                        <label htmlFor="repeat-label" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                          Name for one entry
                        </label>
                        <input
                          id="repeat-label"
                          value={selected.repeatLabel ?? ""}
                          onChange={(e) => updateBlock(selected.id, { repeatLabel: e.target.value })}
                          aria-invalid={!!repeatProblem("repeatLabel")}
                          aria-describedby="repeat-label-help repeat-label-preview repeat-label-error"
                          className={fieldCls}
                        />
                        <p id="repeat-label-help" className="mt-1.5 text-xs text-muted">
                          Write it as it would appear mid-sentence, e.g. <em>patient</em>. Use lower case unless
                          it&apos;s a name or acronym.
                        </p>
                        {repeatPreviewText(selected.repeatLabel) && (
                          <p
                            id="repeat-label-preview"
                            className="mt-1.5 rounded-md bg-surface-3 px-2 py-1 text-xs text-ink-2"
                          >
                            {repeatPreviewText(selected.repeatLabel)}
                          </p>
                        )}
                        {repeatProblem("repeatLabel") && (
                          <p id="repeat-label-error" role="alert" className="mt-1.5 text-xs text-red">
                            {repeatProblem("repeatLabel")}
                          </p>
                        )}
                      </div>

                      {(
                        [
                          ["minOccurs", "Minimum entries", "1", "0 lets the respondent remove every entry."],
                          ["maxOccurs", "Maximum entries", "No limit", "Leave blank for no limit."],
                        ] as const
                      ).map(([field, label, placeholder, help]) => (
                        <div key={field}>
                          <label htmlFor={`repeat-${field}`} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                            {label}
                          </label>
                          <input
                            id={`repeat-${field}`}
                            type="number"
                            inputMode="numeric"
                            min={field === "minOccurs" ? 0 : 1}
                            step={1}
                            value={selected[field] ?? ""}
                            placeholder={placeholder}
                            onChange={(e) => updateBlock(selected.id, { [field]: parseCount(e.target.value) })}
                            aria-invalid={!!repeatProblem(field)}
                            aria-describedby={`repeat-${field}-help repeat-${field}-error`}
                            className={fieldCls}
                          />
                          <p id={`repeat-${field}-help`} className="mt-1.5 text-xs text-muted">
                            {help}
                          </p>
                          {repeatProblem(field) && (
                            <p id={`repeat-${field}-error`} role="alert" className="mt-1.5 text-xs text-red">
                              {repeatProblem(field)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/*
                Help text only where the renderer shows it: on questions. Not on pages,
                groups or display blocks (contract §1, §9–§11); a value already stored on one
                is left alone. Cleared help text is removed, never stored as "".
              */}
              {isAnswerable(selected) && (
                <>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Help text</label>
                  <input
                    value={selected.description ?? ""}
                    onChange={(e) => updateBlock(selected.id, { description: e.target.value || undefined })}
                    placeholder="Optional"
                    className={`${fieldCls} mb-4`}
                  />
                </>
              )}

              {["text", "title", "label"].includes(selected.type) && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Content</label>
                  <textarea
                    value={selected.content ?? ""}
                    onChange={(e) => updateBlock(selected.id, { content: e.target.value })}
                    rows={selected.type === "text" ? 3 : 1}
                    className={`${fieldCls} resize-none`}
                  />
                  {selectedDisplayProblem && (
                    <p role="alert" className="mt-1.5 text-xs text-red">
                      {selectedDisplayProblem}
                    </p>
                  )}
                </div>
              )}

              {["image", "video", "audio", "embed"].includes(selected.type) && (
                <div className="mb-4">
                  <label htmlFor="block-url" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                    URL
                  </label>
                  <input
                    id="block-url"
                    value={selected.content ?? ""}
                    onChange={(e) => updateBlock(selected.id, { content: e.target.value })}
                    placeholder={
                      selected.type === "image"
                        ? "https://… or a path on your app's server, e.g. /images/logo.png"
                        : selected.type === "video"
                          ? "YouTube or Vimeo link, or an .mp4 / .webm address"
                          : selected.type === "audio"
                            ? "An .mp3, .m4a, .ogg or .wav address"
                            : "https://…"
                    }
                    aria-invalid={selected.type !== "embed" && !!selectedDisplayProblem}
                    className={`${fieldCls} font-mono text-xs`}
                  />
                  {/* Audio-only content needs a text alternative (contract §11, WCAG 1.2.1). */}
                  {selected.type === "audio" && (
                    <p className="mt-1.5 text-xs text-muted">
                      Add a transcript in a Text block next to it so everyone can follow.
                    </p>
                  )}
                  {selected.type !== "embed" && selectedDisplayProblem && (
                    <p role="alert" className="mt-1.5 text-xs text-red">
                      {selectedDisplayProblem}
                    </p>
                  )}
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

              {/* Coded lists (contract §13): options, or a matrix's rows and columns. */}
              {OPTION_TYPES.includes(selected.type) &&
                ([
                  [{ list: "options" }, selected.type === "matrix" ? "Rows" : "Options", selected.type === "matrix" ? "row" : "option", "Option"],
                  ...(selected.type === "matrix" ? [[{ list: "columns" }, "Columns", "column", "Column"]] : []),
                ] as [OptionListRef, string, string, "Option" | "Column"][]).map(([ref, heading, noun, placeholder]) => (
                  <OptionListEditor
                    key={ref.list}
                    idPrefix={ref.list}
                    heading={heading}
                    noun={noun}
                    options={optionListAt(selected, ref)}
                    problems={optionListProblems(selected).filter((p) => sameOptionList(p, ref))}
                    status={listStatus(selected.id, ref)}
                    {...optionHandlers(selected.id, ref, placeholder)}
                    onImportFile={(file) => readImportFile(selected.id, ref, heading.toLowerCase(), file)}
                  />
                ))}

              {/*
                A grid (contract §14.6): its rows are a coded list with import, like any
                other; its columns each have a code, a label, a type, Required and, for
                radio and dropdown, their own options with import. Columns aren't imported.
                The note about changing codes is shown once for the whole grid.
              */}
              {isGrid(selected) &&
                (() => {
                  const problems = optionListProblems(selected);
                  const problemsOf = (ref: OptionListRef) => problems.filter((p) => sameOptionList(p, ref));
                  const rowsRef: OptionListRef = { list: "rows" };
                  const columnsRef: OptionListRef = { list: "columns" };
                  const columns = selected.columns ?? [];
                  // The columns' code, label and removal behave as in any coded list; adding is a column's own.
                  const { onAdd: _optionAdd, ...columnRowHandlers } = optionHandlers(selected.id, columnsRef, "Column");
                  return (
                    <>
                      <OptionListEditor
                        idPrefix="rows"
                        heading="Rows"
                        noun="row"
                        options={selected.rows ?? []}
                        problems={problemsOf(rowsRef)}
                        status={listStatus(selected.id, rowsRef)}
                        sharedNoteId="grid-code-note"
                        {...optionHandlers(selected.id, rowsRef, "Row")}
                        onImportFile={(file) => readImportFile(selected.id, rowsRef, "rows", file)}
                      />
                      <GridColumnsEditor
                        columns={columns}
                        problems={problemsOf(columnsRef)}
                        noteId="grid-code-note"
                        {...columnRowHandlers}
                        {...columnHandlers(selected.id)}
                        renderOptions={(k) => {
                          const ref: OptionListRef = { list: "options", column: k };
                          const column = columns[k];
                          return (
                            <OptionListEditor
                              idPrefix={`grid-col-${k}-options`}
                              heading="Options"
                              noun="option"
                              owner={`column ${k + 1}`}
                              options={column && isChoiceColumn(column) ? (column.options ?? []) : []}
                              problems={problemsOf(ref)}
                              status={listStatus(selected.id, ref)}
                              sharedNoteId="grid-code-note"
                              {...optionHandlers(selected.id, ref, "Option")}
                              onImportFile={(file) => readImportFile(selected.id, ref, "options", file, gridColumnName(column, k))}
                            />
                          );
                        }}
                      />
                      <CodeChangeNote id="grid-code-note" className="-mt-2 mb-4" />
                    </>
                  );
                })()}

              {/*
                Only questions can be required: not presentational blocks or groups, and
                not a grid, whose columns are required one by one (canBeRequired).
                A matrix or ranking can also require a complete answer (completeRequired).
                The renderer then requires an answer whatever Required says, so Required
                shows as on, and can't be turned off, while it is set.
              */}
              {canBeRequired(selected) && (() => {
                const completeLabel = COMPLETE_REQUIRED_LABELS[selected.type as keyof typeof COMPLETE_REQUIRED_LABELS];
                const complete = !!completeLabel && !!selected.completeRequired;
                const required = !!selected.required || complete;
                return (
                  <>
                    <div className="flex items-center justify-between border-t border-line py-3 text-[13.5px]">
                      <span id="required-label">Required</span>
                      <Switch
                        checked={required}
                        aria-labelledby="required-label"
                        aria-describedby={complete ? "complete-help" : undefined}
                        disabled={complete}
                        onChange={() => updateBlock(selected.id, { required: !selected.required })}
                      />
                    </div>
                    {completeLabel && (
                      <div className="border-t border-line py-3 text-[13.5px]">
                        <div className="flex items-center justify-between">
                          <span id="complete-label">{completeLabel}</span>
                          <Switch
                            checked={complete}
                            aria-labelledby="complete-label"
                            aria-describedby="complete-help"
                            onChange={(on) => updateBlock(selected.id, { completeRequired: on || undefined })}
                          />
                        </div>
                        <p id="complete-help" className="mt-1 text-xs text-muted">
                          {selected.type === "matrix"
                            ? "Respondents must answer every row. This also makes the question required."
                            : "Respondents must rank every option. This also makes the question required."}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              <ConditionsPanel
                key={selected.id}
                block={selected}
                blocks={schema.blocks}
                onChange={(p) => updateBlock(selected.id, p)}
                pickAnswer={pickAnswer}
              />
              {!(groupTemplate && selected.id === schema.blocks[0]?.id) && (
                <PositionPanel
                  blocks={schema.blocks}
                  blockId={selected.id}
                  onMove={(t) => tryMove(selected.id, t)}
                  onMovePage={(direction) => movePageBy(selected.id, direction)}
                  rootLocked={groupTemplate}
                />
              )}
              {isPage(selected) &&
                (pages.length === 1 ? (
                  <button
                    onClick={removePages}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-3"
                  >
                    Remove pages
                  </button>
                ) : (
                  <button
                    onClick={() => setDeletingPageId(selected.id)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-sm font-medium text-red hover:bg-[#FCECEC]"
                  >
                    <Trash2 className="h-4 w-4" /> Delete page…
                  </button>
                ))}
              {isGroup(selected) && !(groupTemplate && selected.id === schema.blocks[0]?.id) && (
                <button
                  onClick={() => setDeletingGroupId(selected.id)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-sm font-medium text-red hover:bg-[#FCECEC]"
                >
                  <Trash2 className="h-4 w-4" /> Delete group…
                </button>
              )}
            </div>
          ) : groupTemplate ? (
            <div>
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">Group template</h4>
              <p className="text-sm text-muted">
                A group template has no form settings: forms it&apos;s inserted into keep their own. Select a block to edit it.
              </p>
            </div>
          ) : (
            <div>
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">Form settings</h4>
              {templateMode && (
                <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
                  Templates don&apos;t keep settings that send answers somewhere or identify your organisation: the redirect
                  URL, email notifications, logo and cover image. Set those on each form.
                </p>
              )}
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Submit button label</label>
              <input
                value={schema.settings?.submitLabel ?? ""}
                onChange={(e) => updateSettings({ submitLabel: e.target.value })}
                placeholder="Submit"
                className={`${fieldCls} mb-3`}
              />
              {!templateMode && (
                <>
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
                </>
              )}

              <label className="mt-4 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={!!schema.settings?.spamProtection}
                  onChange={(e) => updateSettings({ spamProtection: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-[#6D5EFA]"
                />
                <span>
                  <span className="block text-[12.5px] font-semibold text-ink-2">
                    Spam protection
                  </span>
                  <span className="block text-xs text-muted">
                    Require a Cloudflare Turnstile challenge before submitting.
                  </span>
                </span>
              </label>
              <label className="mt-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={!!schema.settings?.partialSubmissions}
                  onChange={(e) => updateSettings({ partialSubmissions: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-[#6D5EFA]"
                />
                <span>
                  <span className="block text-[12.5px] font-semibold text-ink-2">
                    Capture partial submissions
                  </span>
                  <span className="block text-xs text-muted">
                    Save in-progress answers before the respondent finishes.
                  </span>
                </span>
              </label>

              {!templateMode && (
                <>
                  <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-ink-2">
                    Email notifications
                  </label>
                  <input
                    defaultValue={(schema.settings?.notifyEmails ?? []).join(", ")}
                    onBlur={(e) =>
                      updateSettings({
                        notifyEmails: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="you@team.com, ops@team.com"
                    className={fieldCls}
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Comma-separated. We&apos;ll email these addresses on every new response.
                  </p>
                </>
              )}

              {paged && (
                <>
                  <h4 className="mb-2 mt-5 text-[12.5px] font-semibold text-ink-2">Navigation</h4>
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={schema.navigation?.showProgress ?? NAVIGATION_DEFAULTS.showProgress}
                      onChange={(e) => updateNavigation({ showProgress: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-[#6D5EFA]"
                    />
                    <span>
                      <span className="block text-[12.5px] font-semibold text-ink-2">Show progress</span>
                      <span className="block text-xs text-muted">
                        Shows &lsquo;Step 2 of 5&rsquo; above each page title
                      </span>
                    </span>
                  </label>
                  {/* Kept (not reset) while progress is off, so it comes back as it was. */}
                  <fieldset disabled={!showProgress} className="ml-[26px] mt-2.5 disabled:opacity-50">
                    <legend className="text-[12.5px] font-semibold text-ink-2">Progress style</legend>
                    {(
                      [
                        ["caption", "Text only (“Step 2 of 5”)"],
                        ["bar", "Bar and text"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="mt-1.5 flex items-center gap-2 text-[12.5px] text-ink-2">
                        <input
                          type="radio"
                          name="progress-style"
                          value={value}
                          checked={progressStyle === value}
                          onChange={() => updateNavigation({ progressStyle: value })}
                          className="h-3.5 w-3.5 accent-[#6D5EFA]"
                        />
                        {label}
                      </label>
                    ))}
                    <span className="mt-1 block text-xs text-muted">
                      The client&apos;s app can override this with its own setting.
                    </span>
                  </fieldset>
                  <label className="mt-3 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={schema.navigation?.reviewPage ?? NAVIGATION_DEFAULTS.reviewPage}
                      onChange={(e) => updateNavigation({ reviewPage: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-[#6D5EFA]"
                    />
                    <span>
                      <span className="block text-[12.5px] font-semibold text-ink-2">Review page before submit</span>
                      <span className="block text-xs text-muted">
                        Respondents check their answers before submitting
                      </span>
                    </span>
                  </label>
                </>
              )}

              {/* Where unfinished answers are kept: docs/DRAFTS-CONTRACT.md §2. */}
              <fieldset className="mt-5">
                <legend className="mb-2 text-[12.5px] font-semibold text-ink-2">Save progress</legend>
                {(
                  [
                    ["session", "Only while the form is open", "Answers survive a page refresh, but not closing the tab."],
                    [
                      "device",
                      "On this device",
                      "Answers are saved, encrypted, on the respondent's device and can be continued later. Needs setup by the developer of the app the form is used in.",
                    ],
                    [
                      "server",
                      "On the app's server",
                      "Answers are saved by the app the form is used in, at each page change. Needs setup by that app's developer. Visit this page for documentation on set up.",
                    ],
                  ] as const
                ).map(([mode, label, help]) => {
                  const available = draftModeAvailable(mode, schema.blocks);
                  return (
                    <label
                      key={mode}
                      className={`mt-2 flex items-start gap-2.5 ${available ? "" : "opacity-50"}`}
                    >
                      <input
                        type="radio"
                        name="draft-mode"
                        value={mode}
                        checked={(schema.drafts?.mode ?? DEFAULT_DRAFT_MODE) === mode}
                        disabled={!available}
                        onChange={() => updateDrafts(mode)}
                        className="mt-0.5 h-4 w-4 accent-[#6D5EFA]"
                      />
                      <span>
                        <span className="block text-[12.5px] font-semibold text-ink-2">{label}</span>
                        <span className="block text-xs text-muted">{help}</span>
                        {!available && (
                          <span className="mt-0.5 block text-xs font-medium text-ink-2">
                            Available for forms with pages
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
                <p className="mt-2.5 text-xs text-muted">
                  If the app hasn&apos;t been set up for the option chosen, the form falls back to &lsquo;Only while
                  the form is open&rsquo;.
                </p>
              </fieldset>

              {!templateMode && (
                <>
                  <h4 className="mb-3 mt-6 border-t border-line pt-4 text-[11px] font-bold uppercase tracking-wider text-faint">
                    AI tools
                  </h4>
                  <button
                    onClick={onSuggestLogic}
                    disabled={logicBusy}
                    className="btn btn-outline btn-sm w-full"
                  >
                    {logicBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Suggest logic & branching
                  </button>
                  {logicTips && (
                    <ul className="mt-2 space-y-1.5">
                      {logicTips.map((t, i) => (
                        <li key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
                          <span className="font-semibold">If</span> {t.when} →{" "}
                          <span className="font-semibold">then</span> {t.then}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex gap-2">
                    <input
                      value={transLang}
                      onChange={(e) => setTransLang(e.target.value)}
                      placeholder="Language"
                      className={fieldCls}
                    />
                    <button
                      onClick={onTranslate}
                      disabled={transBusy}
                      className="btn btn-outline btn-sm flex-none"
                    >
                      {transBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Translate
                    </button>
                  </div>
                  {transNote && <p className="mt-1.5 text-xs text-muted">{transNote}</p>}
                </>
              )}

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

              {!templateMode && (
                <>
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
                </>
              )}

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
