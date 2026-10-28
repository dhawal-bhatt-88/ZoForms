"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  GripVertical,
  LayoutTemplate,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  addGridColumn,
  allBlockIds,
  canInsertAsPage,
  answerCode,
  applyImport,
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
  fillQuestionNames,
  findBlock,
  generateQuestionName,
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
  isWithinScoreReach,
  logicTreeToText,
  makePaged,
  moveBlockInTree,
  moveGridColumn,
  movePage,
  NAME_PATTERN,
  namesAfterInsert,
  namesTakenFor,
  NAVIGATION_DEFAULTS,
  navigationWithoutDefaults,
  newBlock,
  newConditionId,
  newGroup,
  newPage,
  newPageTitle,
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
  renameQuestion,
  renumberAfterDelete,
  replaceBlockers,
  REPEAT_DEFAULTS,
  repeatsOnBlockers,
  repeatsOnScoreBlockers,
  rangeSettingsProblems,
  repeatSettingsProblems,
  SCALE_DEFAULTS,
  SCALE_MAX_POINTS,
  resolveNameClashes,
  sameContent,
  sameOptionList,
  scoreDeletionBlockers,
  scoredOptionList,
  scoreProblems,
  scoreTypeChangeBlockers,
  scoreUseMessage,
  sourceOperators,
  structureBreaks,
  unwrapGroup,
  updateBlockInTree,
  updateGridColumn,
  walkBlocks,
  withColumnType,
  withOptionList,
  type Block,
  type Condition,
  type Score,
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
import { inspectorHeading, logicNoun, TEXT_ONLY_TYPES, textFieldEdit } from "@/lib/inspector";
import { CATALOG_BLOCK_COUNT, catalogLabel, matchCatalog, type CatalogItem } from "@/lib/block-catalog";
import { parseCount, repeatBadgeText, repeatPreviewText } from "@/lib/repeat-settings";
import { OptionImportDialog } from "@/components/option-import-dialog";
import { CodeChangeNote, OptionListEditor } from "@/components/option-list-editor";
import { GridColumnsEditor } from "@/components/grid-columns-editor";
import { ScoresPanel } from "@/components/scores-panel";
import { Switch } from "@/components/switch";
import { MenuButton, type MenuItem } from "@/components/menu-button";
import { Dialog } from "@/components/dialog";
import { THEME_CHOICES, ThemeToggle, useThemeChoice } from "@/components/theme-toggle";
import {
  Button,
  buttonClasses,
  Callout,
  Checkbox,
  EmptyState,
  ConfirmDialog,
  controlClasses,
  Field,
  Input,
  Loading,
  segmentClasses,
  segmentTrackClasses,
  Select,
  Skeleton,
  StatusChip,
  Textarea,
  useToast,
} from "@/components/ui";
import { cn } from "@formbuilder/ui";
import { SaveTemplateDialog } from "@/components/templates/save-template-dialog";
import { TemplatePicker } from "@/components/templates/template-picker";
import { canEditAs, useMe } from "@/lib/use-can-edit";
import { SETTINGS_PANE_HEADING_ID, SETTINGS_PANE_ID, SettingsPaneHandle, useSettingsPane } from "./settings-pane";
import { SaveStatus, useSaveAnnouncement } from "./save-status";
import { LeaveLink } from "./leave-link";
import { BlockChips, BlockIcon, BlockPreview, DropLine, GroupBox, PAGE_BOX, PAGE_HEADER, PageLabel, RequiredMark } from "./canvas-preview";
import {
  ApiError,
  downloadArtifact,
  getForm,
  getTemplate,
  saveSchema,
  updateTemplate,
  type TemplateDetail,
  type TemplateKind,
  type TemplateScope,
} from "@/lib/api";

/** A notice's meaning: an edit refused, a save or download failed, or a neutral note. */
type NoticeTone = "warn" | "fail" | "info";

/**
 * The insert menu: a ZoBlocks popover holding a search box and the catalog,
 * filtered as the author types. The ARIA combobox pattern: focus stays in the
 * search box; Up and Down move the active block (wrapping), Enter inserts it
 * (the first match until the arrows move), Escape and Tab close the menu. How
 * many blocks match is said politely as the author types.
 */
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
  const baseId = useId();
  const [active, setActive] = useState(0);
  const q = query.trim().toLowerCase();
  const groups = matchCatalog(q);

  const flat = groups.flatMap((g) => g.items);
  const optionId = (i: number) => `${baseId}-option-${i}`;
  const listId = `${baseId}-list`;

  // A new query starts from the first match again.
  useEffect(() => setActive(0), [q]);
  // The active option stays in view as the arrows move it.
  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[active]) onPick(flat[active]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      onClose();
    }
  }

  let index = -1;
  return (
    <div
      data-block-menu
      style={{ position: "fixed", left: pos.left, top: pos.top }}
      className="rise-in surface z-40 flex max-h-[420px] w-[320px] flex-col overflow-hidden shadow-[0_18px_44px_-18px_rgb(2_20_17/0.28)]"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex flex-none items-center gap-2 border-b border-rule px-3 py-2">
        <Search aria-hidden="true" className="h-4 w-4 flex-none text-graphite-soft" />
        <input
          autoFocus
          role="combobox"
          aria-label="Search blocks"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={flat[active] ? optionId(active) : undefined}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search blocks…"
          className="w-full bg-transparent text-[0.875rem] text-ink outline-none placeholder:text-graphite-soft"
          spellCheck={false}
        />
      </div>
      {groups.length === 0 && (
        <p className="px-3 py-4 text-center text-[0.8125rem] text-graphite">No blocks match “{query}”.</p>
      )}
      {/* The listbox is the scroller: it is the combobox's popup, which keyboard
          users move through with the arrow keys from the search field. A
          wrapper scrolling instead is a region the keyboard can't reach (axe's
          scrollable-region-focusable). */}
      <div role="listbox" id={listId} aria-label="Blocks" className="min-h-0 overflow-y-auto p-1.5">
          {groups.map((g) => (
            <div key={g.group} role="group" aria-labelledby={`${baseId}-${g.group}`} className="mb-1 last:mb-0">
              <div id={`${baseId}-${g.group}`} className="eyebrow px-2 pb-1 pt-2 text-graphite-soft">
                {g.group}
              </div>
              {g.items.map((it) => {
                const i = ++index;
                const label = catalogLabel(it);
                return (
                  <div
                    key={`${it.type}-${label}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    data-block-type={it.template ? undefined : it.type}
                    onClick={() => onPick(it)}
                    onMouseMove={() => i !== active && setActive(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] transition-colors duration-150",
                      i === active ? "bg-accent-wash text-ink" : "text-graphite",
                    )}
                  >
                    {it.template ? (
                      <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-md bg-accent-wash text-brand-deep">
                        <LayoutTemplate className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <BlockIcon type={it.type} />
                    )}
                    <span data-label className="flex-1">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
      {/* Said once the author has typed: "3 blocks", or that nothing matches. */}
      <p aria-live="polite" className="sr-only">
        {q ? (flat.length ? `${flat.length} ${flat.length === 1 ? "block" : "blocks"}` : "No blocks match") : ""}
      </p>
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
  return (
    <section
      data-page-box={page.id}
      data-drop-target={dropTarget || undefined}
      className={cn(PAGE_BOX, dropTarget || selected ? "border-brand-deep ring-[3px] ring-brand/20" : "border-rule-strong")}
    >
      <div
        ref={setNodeRef}
        data-block-id={page.id}
        data-depth={0}
        onClick={onSelect}
        className={cn(
          PAGE_HEADER,
          "cursor-pointer",
          item.collapsed ? "rounded-[0.75rem]" : "rounded-t-[0.75rem] border-b border-rule",
          dropTarget ? "bg-accent-wash" : "bg-paper-sunk",
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-expanded={!item.collapsed}
          aria-label={item.collapsed ? `Expand page "${name}"` : `Collapse page "${name}"`}
          className={CARD_ICON}
        >
          {item.collapsed ? <ChevronRight aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
        </button>
        <PageLabel number={pageNumber} />
        <span aria-hidden="true" className="flex-none text-graphite-soft">
          ·
        </span>
        {/* The page's own keyboard stop: focusing its title selects the page. */}
        <input
          value={page.title}
          aria-label={`Page ${pageNumber} title`}
          placeholder="Untitled page"
          onChange={(e) => onTitle(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={onSelect}
          className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[0.9375rem] font-semibold text-ink outline-none transition-colors duration-200 ease-out-expo placeholder:text-graphite-soft hover:bg-surface focus:border-brand-deep focus:bg-surface"
          spellCheck={false}
        />
        <BlockChips block={page} />
        {item.collapsed && (
          <span className="flex-none text-[0.75rem] text-graphite">
            {hiddenCount} {hiddenCount === 1 ? "block" : "blocks"} inside
          </span>
        )}
        <div className="flex flex-none items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove(-1);
            }}
            disabled={!canMoveUp}
            className={CARD_ICON}
            aria-label="Move page up"
          >
            <ArrowUp aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove(1);
            }}
            disabled={!canMoveDown}
            className={CARD_ICON}
            aria-label="Move page down"
          >
            <ArrowDown aria-hidden="true" className="h-4 w-4" />
          </button>
          {onlyPage ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePages();
              }}
              className={buttonClasses({ variant: "ghost", size: "sm", className: "text-graphite ease-out-expo hover:text-ink" })}
            >
              Remove pages
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className={CARD_DELETE}
              aria-label="Delete page"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {children && <div className="flex flex-col gap-2.5 p-3">{children}</div>}
    </section>
  );
}

/** The canvas's icon controls: the kit's ghost icon button, with the ZoBlocks hover easing. */
const CARD_ICON = buttonClasses({ variant: "ghost", size: "icon", className: "h-7 w-7 flex-none text-graphite ease-out-expo hover:text-ink" });
/** Delete, among them: quiet until hovered, then the fail colour. */
const CARD_DELETE = buttonClasses({ variant: "danger-ghost", size: "icon", className: "h-7 w-7 flex-none ease-out-expo" });

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
  /** Select this block; `toPane` also takes focus to its settings (a keyboard selection). */
  onSelect: (toPane: boolean) => void;
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
  const hiddenCount = group && item.collapsed ? walkBlocks(group.blocks).length : 0;
  const unlabelled = !!group && !group.label.trim();
  const name = unlabelled ? "Unlabelled group" : blockName(block);
  const kind = inspectorHeading(block).toLowerCase();

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      data-depth={item.depth}
      onClick={() => onSelect(false)}
      className={cn(
        "group relative cursor-pointer transition-[background-color,border-color,box-shadow] duration-200 ease-out-expo",
        // A group's card is the header inside its box; the box shows selection.
        group
          ? "rounded-[0.625rem] px-1.5 py-2.5"
          : cn(
              "rounded-[0.625rem] border p-3.5",
              selected ? "border-brand-deep bg-surface ring-[3px] ring-brand/20" : "border-transparent hover:border-rule-strong hover:bg-surface",
            ),
        isDragging && !group && "opacity-40",
      )}
    >
      {/*
        The keyboard's way in, as on the My forms cards: a button over the whole
        card, so its focus ring follows the card's corners. Enter or Space selects
        the block and takes focus to its settings. The pointer passes through it
        (the card's own click selects), and the card's controls sit above it.
      */}
      <button
        type="button"
        data-select-block
        aria-label={`Edit ${kind}${number !== undefined ? ` ${number}` : ""}: ${name}`}
        aria-current={selected || undefined}
        aria-controls={SETTINGS_PANE_ID}
        onClick={(e) => {
          e.stopPropagation();
          // A click from the keyboard has no pointer, so detail is 0.
          onSelect(e.detail === 0);
        }}
        // Forced colours removes the ring's box-shadow, so an outline takes over there.
        className="pointer-events-none absolute inset-0 rounded-[0.625rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-surface forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-2 forced-colors:focus-visible:outline-[Highlight]"
      />
      {dropLine && <DropLine at={dropLine} />}
      <div className={cn("flex items-center gap-2 pr-[88px]", !group && "mb-2.5")}>
        {/* For the pointer only: the keyboard moves blocks with Move up, Move down and Move to…. */}
        <button
          {...attributes}
          {...listeners}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="relative cursor-grab text-graphite-soft opacity-0 transition-opacity duration-200 ease-out-expo hover:text-ink active:cursor-grabbing group-focus-within:opacity-100 group-hover:opacity-100"
          aria-label="Drag to reorder"
        >
          <GripVertical aria-hidden="true" className="h-4 w-4" />
        </button>
        {group && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-expanded={!item.collapsed}
            aria-label={item.collapsed ? `Expand group "${group.label}"` : `Collapse group "${group.label}"`}
            className={cn(CARD_ICON, "relative h-6 w-6 p-1")}
          >
            {item.collapsed ? <ChevronRight aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
          </button>
        )}
        <BlockIcon type={block.type} />
        {number !== undefined && (
          <span className="flex-none text-[0.8125rem] font-semibold tabular-nums text-graphite">{number}.</span>
        )}
        <span className={cn("min-w-0 truncate font-semibold", unlabelled && "italic text-graphite-soft")}>{name}</span>
        {/* "Answer every row" / "Rank every option" make the question required too (the renderer's rule). */}
        {(block.required || block.completeRequired) && <RequiredMark />}
        <BlockChips block={block} level={item.level} />
        {group && item.collapsed && (
          <span className="flex-none text-[0.75rem] text-graphite">
            {hiddenCount} {hiddenCount === 1 ? "block" : "blocks"} inside
          </span>
        )}
      </div>
      {!group && <BlockPreview block={block} />}

      {/* Visible on hover, and whenever focus is in the card, so these work from the keyboard. */}
      <div className="absolute right-2 top-2 z-10 flex gap-0.5 opacity-0 transition-opacity duration-200 ease-out-expo focus-within:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100">
        {group && menu && <MenuButton label={`More actions for group "${blockName(group).trim() || "Unlabelled group"}"`} items={menu} />}
        {!locked && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
              }}
              disabled={!canMoveUp}
              className={CARD_ICON}
              aria-label="Move up"
            >
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(1);
              }}
              disabled={!canMoveDown}
              className={CARD_ICON}
              aria-label="Move down"
            >
              <ArrowDown aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className={CARD_DELETE}
              aria-label={group ? "Delete group" : "Delete"}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
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
        type="button"
        onClick={(e) => onAdd(e.currentTarget)}
        // Graphite either way: an empty page or group is something to fill, not a warning.
        className={buttonClasses({ variant: "ghost", size: "sm", className: "-ml-1 text-graphite ease-out-expo hover:text-brand-deep" })}
      >
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        {group.blocks.length ? `Add to "${name}"` : `"${name}" is empty — add a block to it`}
      </button>
    </div>
  );
}

/** What follows the pointer while dragging: the block's icon and label. */
function DragGhost({ block }: { block: Block }) {
  const inside = isGroup(block) ? walkBlocks(block.blocks).length : 0;
  return (
    <div className="flex h-full items-start gap-2 rounded-[0.625rem] border border-brand-deep bg-surface px-3.5 py-2.5 shadow-[0_18px_44px_-18px_rgb(2_20_17/0.28)]">
      <BlockIcon type={block.type} />
      <span className="min-w-0 truncate font-semibold">{blockName(block).trim() || "Unlabelled group"}</span>
      {isGroup(block) && (
        <span className="flex-none pt-0.5 text-[0.75rem] text-graphite">
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
  const count = `${inside.length} ${inside.length === 1 ? "block" : "blocks"}`;

  return (
    <Dialog
      title={`Delete the group "${name}"?`}
      description={`It contains ${count}. Choose what happens to them.`}
      onClose={onClose}
      footer={
        <Button size="sm" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <ChoiceCard
          autoFocus
          title="Group only (keep questions)"
          body="Its contents move up to where the group is now, in the same order."
          notes={conditionNote ? [conditionNote] : []}
          onClick={onKeep}
        />
        <ChoiceCard
          danger
          title="Group and its questions"
          body={`Deletes the group and all ${count} inside it.`}
          onClick={onDeleteAll}
        />
      </div>
    </Dialog>
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

  const count = `${inside.length} ${inside.length === 1 ? "block" : "blocks"}`;

  return (
    <Dialog
      title={`Delete the page "${name}"?`}
      description={`It contains ${count}. Choose what happens to them.`}
      onClose={onClose}
      footer={
        <Button size="sm" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <ChoiceCard
          autoFocus
          title={`Page only (move contents to the ${first ? "next" : "previous"} page)`}
          body={
            first
              ? `Its contents move to the start of "${destination?.title ?? "the next page"}", in the same order.`
              : `Its contents move to the end of "${destination?.title ?? "the previous page"}", in the same order.`
          }
          notes={[lostNote, gainedNote].filter((n): n is string => !!n)}
          onClick={onKeep}
        />
        <ChoiceCard
          danger
          title="Page and its contents"
          body={`Deletes the page and all ${count} on it.`}
          onClick={onDeleteAll}
        />
      </div>
    </Dialog>
  );
}

/** The confirm before a single-page form becomes a paged one. */
function PagingDialog({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog
      title="Split this form into pages?"
      description="Your questions will move to Page 1, and a new, empty Page 2 is added after it."
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" data-autofocus onClick={onConfirm}>
            Add pages
          </Button>
        </>
      }
    />
  );
}

/**
 * The editor as it loads: the top bar, the canvas and the pane in outline, so
 * nothing moves when they arrive. Announced once, as a whole.
 */
function EditorSkeleton({ label, paneWidth }: { label: string; paneWidth: number }) {
  return (
    <Loading label={label} className="flex h-screen flex-col bg-paper">
      <div className="flex h-14 flex-none items-center gap-3 border-b border-rule bg-surface px-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-28" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-14 rounded-lg" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: `minmax(0,1fr) ${paneWidth}px` }}>
        <div className="overflow-hidden px-6 py-8">
          <div className="mx-auto max-w-[680px] rounded-[0.875rem] border border-rule bg-surface p-8">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="mt-3 h-4 w-1/2" />
            <div className="mt-8 flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-l border-rule bg-surface p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </Loading>
  );
}

/**
 * One of a delete dialog's two choices: a card that is a button, with what
 * the choice changes in a warning beside it, bound to it as its description
 * (a button can't hold a callout). The destructive choice is the fail
 * colour's text and border, never a filled red.
 */
function ChoiceCard({
  title,
  body,
  notes = [],
  danger = false,
  autoFocus = false,
  onClick,
}: {
  title: string;
  body: string;
  /** What this choice changes beyond the obvious, e.g. conditions that stop applying. */
  notes?: string[];
  danger?: boolean;
  autoFocus?: boolean;
  onClick: () => void;
}) {
  const notesId = useId();
  return (
    <div>
      <button
        type="button"
        data-autofocus={autoFocus || undefined}
        onClick={onClick}
        aria-describedby={notes.length ? notesId : undefined}
        className={cn(
          "w-full rounded-xl border bg-surface px-4 py-3 text-left transition-[background-color,border-color] duration-200",
          danger ? "border-fail/40 hover:border-fail hover:bg-fail-wash" : "border-rule-strong hover:border-brand-deep hover:bg-accent-wash",
        )}
      >
        <span className={cn("block text-[0.8125rem] font-semibold", danger ? "text-fail" : "text-ink")}>{title}</span>
        <span className="body-sm mt-0.5 block text-graphite">{body}</span>
      </button>
      {notes.length > 0 && (
        <div id={notesId} className="mt-1.5">
          <Callout tone="warn" title="What this changes" items={notes} />
        </div>
      )}
    </div>
  );
}

/**
 * A heading's level, H1 to H3: a radio group on `segmentClasses`, so the
 * chosen level is a state to a screen reader and a border to the eye, not a
 * colour alone. One tab stop; the arrow keys move the choice, as in any radio group.
 */
function HeadingLevel({ value, onChange, labelledBy }: { value: number; onChange: (level: number) => void; labelledBy: string }) {
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const levels = [1, 2, 3];
  function onKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + levels.length) % levels.length;
    onChange(levels[next]);
    radios.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={segmentTrackClasses("flex w-full")}>
      {levels.map((level, i) => (
        <button
          key={level}
          ref={(el) => {
            radios.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === level}
          tabIndex={value === level ? 0 : -1}
          onClick={() => onChange(level)}
          onKeyDown={(e) => onKey(e, i)}
          className={segmentClasses({ selected: value === level, size: "sm", className: "flex-1" })}
        >
          H{level}
        </button>
      ))}
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
  const rawUp = stepMove(blocks, blockId, -1);
  const rawDown = stepMove(blocks, blockId, 1);
  const up = allowed(rawUp);
  const down = allowed(rawDown);
  const destinations = moveDestinations(blocks, blockId).filter((d) => !(rootLocked && d.id === null));
  const ROOT = "__top_level__";
  const destinationName = (d: (typeof destinations)[number]) => (d.id === null ? "Top level (outside any group)" : d.path.join(" › "));
  // A path is the author's own labels and can outgrow the select at any width, so the choice is also written out in full.
  const chosen = destinations.find((d) => (d.id ?? ROOT) === destination);
  const chosenId = useId();
  // Why a step isn't offered: the end of the form, or (in a group template) the edge of its one group.
  const stepReason = (raw: MoveTarget | null, end: "top" | "bottom") =>
    raw ? "It can't leave the template's group." : `It's already at the ${end}.`;

  function moveInto() {
    if (!destination) return;
    const parentId = destination === ROOT ? null : destination;
    const target = parentId ? findBlock(blocks, parentId)?.block : null;
    // Appended at the end: the moving block isn't among the destination's children.
    const index = target && isContainer(target) ? target.blocks.length : blocks.length;
    onMove({ parentId, index });
    setDestination("");
  }

  // Two equal columns, so neither label wraps at the pane's narrowest; a reason sits under its button.
  const steps = (onUp: (() => void) | null, onDown: (() => void) | null, upReason: string, downReason: string) => (
    <div className="grid grid-cols-2 items-start gap-1.5">
      <Button size="sm" className="w-full" onClick={() => onUp?.()} reason={onUp ? undefined : upReason}>
        <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> Move up
      </Button>
      <Button size="sm" className="w-full" onClick={() => onDown?.()} reason={onDown ? undefined : downReason}>
        <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /> Move down
      </Button>
    </div>
  );

  if (pageAt >= 0) {
    return (
      <div className="mt-3 border-t border-rule pt-3">
        <h3 className="eyebrow mb-2 text-graphite-soft">Position</h3>
        {steps(
          pageAt > 0 ? () => onMovePage(-1) : null,
          pageAt < blocks.length - 1 ? () => onMovePage(1) : null,
          "It's already the first page.",
          "It's already the last page.",
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-rule pt-3">
      <h3 className="eyebrow mb-2 text-graphite-soft">Position</h3>
      {steps(up ? () => onMove(up) : null, down ? () => onMove(down) : null, stepReason(rawUp, "top"), stepReason(rawDown, "bottom"))}
      <div className="mt-2 flex flex-col items-start gap-1.5">
        <Select
          size="sm"
          aria-label="Move to"
          aria-describedby={chosen ? chosenId : undefined}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        >
          <option value="">Move to…</option>
          {destinations.map((d) => (
            <option key={d.id ?? ROOT} value={d.id ?? ROOT}>
              {destinationName(d)}
            </option>
          ))}
        </Select>
        {chosen && (
          <p id={chosenId} className="break-words text-[0.75rem] text-graphite">
            To the end of <span className="text-ink">{destinationName(chosen)}</span>
          </p>
        )}
        <Button size="sm" onClick={moveInto} reason={destination ? undefined : "Choose a page or group above first."}>
          Move
        </Button>
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

/** A condition's text and number boxes; its selects are the kit's `Select` at the same size. */
const logicField = controlClasses({ size: "sm" });

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
      <Select
        size="sm"
        aria-label={label}
        value={current >= 0 ? String(current) : ""}
        onChange={(e) => onChange(pick(source, Number(e.target.value)))}
      >
        {current < 0 && <option value="">{typeof value === "string" && value ? value : "Choose…"}</option>}
        {options.map((o, k) => (
          <option key={k} value={String(k)}>
            {o.label}
          </option>
        ))}
      </Select>
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
      <div className="border-t border-rule pt-3">
        <h3 className="eyebrow mb-1.5 text-graphite-soft">Logic</h3>
        <p className="text-[0.75rem] text-graphite">The first page can&apos;t have conditions — it is always shown.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-rule pt-3">
      <h3 className="eyebrow mb-1.5 text-graphite-soft">Logic</h3>
      <p className="mb-2 text-[0.8125rem] font-medium text-ink">Show this {noun} only when…</p>

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
            <div key={key} data-condition className="rounded-lg border border-rule bg-paper-sunk p-2">
              <div className="mb-1.5 flex items-center justify-between gap-1.5">
                <span className="eyebrow text-graphite-soft">Condition {n}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(i)}
                  className="text-graphite hover:text-ink"
                  aria-label={`Remove condition ${n}`}
                  aria-describedby={refused ? refusalId : undefined}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
              {/* One control per line: side by side, the pane's narrowest width clipped "is greater than". */}
              <div className="flex flex-col gap-1.5">
                <Select
                  size="sm"
                  aria-label={`Condition ${n} question`}
                  value={c.question}
                  onChange={(e) => {
                    const next = findBlock(blocks, e.target.value)!.block;
                    const ops = sourceOperators(next) ?? [];
                    setAt(i, retarget(c, next, ops.includes(c.operator) ? c.operator : "exists", firstAnswer));
                  }}
                >
                  {!eligible && <option value={c.question}>{source ? blockName(source) : "Missing question"}</option>}
                  {sourceOptions}
                </Select>
                <Select
                  size="sm"
                  aria-label={`Condition ${n} operator`}
                  value={c.operator}
                  disabled={!source}
                  onChange={(e) => source && setAt(i, retarget(c, source, e.target.value as ConditionOperator, firstAnswer))}
                >
                  {!operators.includes(c.operator) && <option value={c.operator}>{OPERATOR_TEXT[c.operator]}</option>}
                  {operators.map((op) => (
                    <option key={op} value={op}>
                      {OPERATOR_TEXT[op]}
                    </option>
                  ))}
                </Select>
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
                  <p data-field-error className="mt-1.5 flex items-start gap-1 text-[0.75rem] text-fail">
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
        <Button ref={addButton} variant="ghost" size="sm" onClick={addCondition} className="-ml-2.5 mt-1.5">
          <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add condition
        </Button>
      ) : (
        !hiddenByRepeats && (
          <p className="text-[0.75rem] text-graphite">
            Only questions before this {noun} can be used. Add or move a question before it first.
          </p>
        )
      )}

      {conditions.length >= 2 && (
        <Field id={fieldId} label="Logic" optional={false} hint={LOGIC_HINT} error={logicError} liveError className="mt-3">
          {(field) => (
            <Textarea
              {...field}
              mono
              value={text}
              rows={2}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => typeLogic(e.target.value)}
              onBlur={(e) => {
                clearTimeout(timer.current);
                setChecked(e.target.value);
              }}
              className="block px-2.5 py-1.5 text-[0.8125rem]"
            />
          )}
        </Field>
      )}

      {problems.map((p, i) => (
        <p key={i} data-field-error className="mt-2 text-[0.75rem] text-fail">
          {p}
        </p>
      ))}

      {hiddenByRepeats && (
        <p className="mt-2 text-[0.75rem] text-graphite">
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
    blocks: normalizeScores(normalizeConditions(s?.blocks ?? [])),
    navigation: s?.navigation,
    drafts: s?.drafts,
    templateRef: s?.templateRef,
  };
}

/**
 * The form editor. With `templateId` it edits a template instead ("template
 * mode"): the same canvas, inspector, save rules, Save and Cancel, but Save
 * writes to the template, and what only applies to a form — Download — isn't
 * offered. A group template is edited as a form whose only root item is its
 * group, and it can't gain more root items.
 */
export default function FormEditor({ templateId }: { templateId?: string }) {
  const params = useParams();
  // A form's id; in template mode the route's id is the template's, and isn't used as a form's.
  const id = String(params.id);
  const templateMode = templateId !== undefined;
  // The template being edited: its name, kind, and the version the edit started from.
  const [template, setTemplate] = useState<{ name: string; kind: TemplateKind; version: number; scope: TemplateScope } | null>(null);
  const groupTemplate = template?.kind === "group";
  // The signed-in member: their role, and their settings pane width, so the pane is laid out once.
  const user = useMe();
  // Viewers aren't offered "Save as template" (the API refuses it with 403 anyway).
  const canEdit = canEditAs(user);
  const pane = useSettingsPane(
    user.status === "loading" ? undefined : user.status === "ready" ? user.me.settingsPaneWidth : null,
  );
  // A template that can't be saved here: a system template, or anything for a viewer. No Save or Cancel.
  const readOnlyTemplate = templateMode && (template?.scope === "system" || !canEdit);
  // A viewer, by role: if `me` failed, the API decides, so an author is never locked out by a network blip.
  const viewer = user.status === "ready" && user.me.role === "VIEWER";
  // Nothing here can be saved: no Save or Cancel, never dirty, no warning on leaving.
  const readOnly = readOnlyTemplate || viewer;
  const toast = useToast();

  const [schema, setSchema] = useState<FormSchema | null>(null);
  // The latest saved version's content: the baseline for dirty-state and Cancel.
  const [saved, setSaved] = useState<FormSchema | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [theme, chooseTheme] = useThemeChoice();
  // A message under the header; `blocks` are questions to offer "jump to" links for. Its tone is
  // its meaning: `warn` an edit that was refused (nothing is broken, it just didn't happen), `fail`
  // a save or download that failed, `info` a neutral note (e.g. a setting switched for the author).
  const [notice, setNotice] = useState<{ id: number; text: string; blocks?: Block[]; tone: NoticeTone } | null>(null);
  const noticeCount = useRef(0);
  /** Show a notice; a refusal unless `tone` says otherwise. A new id remounts it, so it is announced even if the words repeat. */
  const notify = ({ tone = "warn", ...rest }: { text: string; blocks?: Block[]; tone?: NoticeTone }) =>
    setNotice({ ...rest, tone, id: ++noticeCount.current });
  // What a screen reader hears after an edit with no other voice: a move, a delete, an insert.
  // Each message is a new node, so the same words twice are said twice.
  const [said, setSaid] = useState({ n: 0, text: "" });
  const say = (text: string) => setSaid((s) => ({ n: s.n + 1, text }));
  // The standing note on a screen that can't be saved, until dismissed.
  const [readOnlyNoteDismissed, setReadOnlyNoteDismissed] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [menuAnchor, setMenuAnchor] = useState({ left: 0, top: 0 });
  // What had focus when the insert menu opened: where focus goes back if it's closed without a pick.
  const menuOpener = useRef<HTMLElement | null>(null);
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
  // A screen that can't be saved (`readOnly`) is never dirty: there is nothing to lose by leaving.
  const dirty = useMemo(
    () => !readOnly && !!schema && !!saved && !sameContent(schema, saved),
    [schema, saved, readOnly],
  );
  const saveAnnouncement = useSaveAnnouncement(dirty);
  // Cancel and Save, blocked for one reason, say it once.
  const saveReasonId = useId();
  // The Cancel confirmation is open.
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // A grid column's type change waiting for the author's answer (it would remove the column's options).
  const [typeChange, setTypeChange] = useState<{ blockId: string; index: number; type: GridColumnType; warning: string } | null>(null);

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

  async function onSave() {
    if (!schema || !dirty || saving || readOnly) return;
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
      saveAnnouncement.announce("Changes saved.");
    } catch (e) {
      if (e instanceof ApiError && e.code === "NO_CHANGES") {
        // Identical to the current version: nothing to save. Its empty codes get
        // the codes the saved version has — the same rule, applied here.
        const filled = FormSchema.parse(sent);
        setSaved(filled);
        setSchema((s) => (s === sent ? filled : s));
        saveAnnouncement.announce("Changes saved.");
      } else if (e instanceof ApiError && e.code === "VERSION_CONFLICT") {
        // Keep the unsaved edits; the author decides whether to reload.
        notify({ tone: "fail", text: e.message });
      } else {
        notify({ tone: "fail", text: `Couldn't save: ${(e as Error).message}` });
      }
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    if (!saved || !dirty) return;
    setConfirmingCancel(true);
  }

  /** Cancel, confirmed: back to the latest saved version. */
  function discardChanges() {
    if (!saved) return;
    setSchema(saved);
    setNotice(null);
    saveAnnouncement.announce("Changes discarded.");
  }

  async function onDownload() {
    setDownloading(true);
    try {
      await downloadArtifact(id); // latest saved version, never the unsaved editor state
    } catch (e) {
      notify({ tone: "fail", text: `Couldn't download: ${(e as Error).message}` });
    } finally {
      setDownloading(false);
    }
  }

  const patch = (fn: (s: FormSchema) => FormSchema) =>
    setSchema((s) => (s ? fn(s) : s));

  const openMenu = (anchor?: HTMLElement | null, target: MoveTarget | null = null) => {
    menuOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    // A new question's name waits for its real label (contract §17.8).
    if (isAnswerable(b)) newQuestions.current.add(b.id);
    patch((s) => ({ ...s, blocks: insertBlockIntoTree(s.blocks, target.parentId, target.index, b) }));
    if (target.parentId) expand(target.parentId);
    // The new block's settings take focus: its label is the next thing to write.
    selectBlock(b.id, true);
    say(`Added ${catalogLabel(item)}.`);
    setMenuOpen(false);
    setMenuQuery("");
    setInsertTarget(null);
  };
  /** Closed without a pick: focus goes back where it was. */
  const closeMenu = () => {
    setMenuOpen(false);
    setMenuQuery("");
    menuOpener.current?.focus();
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
      const page = pageForTemplateGroup(group, allBlockIds(schema.blocks), schema.blocks);
      const after = currentPageId();
      next = after ? insertPageAfter(schema.blocks, after, page) : [page];
    } else {
      if (groupTemplate && picking.parentId === null) return;
      next = insertBlockIntoTree(schema.blocks, picking.parentId, picking.index, group);
    }
    setPicking(null);
    if (refuseStructureEdit(structureBreaks(schema.blocks, next), `insert "${t.name}" there`)) return;
    // Inside a scored group, a copy's clashing names get suffixes and its own formulas follow (contract §17.9).
    const named = namesAfterInsert(schema.blocks, next, group, { skip: newQuestions.current });
    patch((s) => ({ ...s, blocks: named }));
    if (as === "group" && picking.parentId) expand(picking.parentId);
    setSelectedId(group.id);
    toast.show({ tone: "pass", title: `Inserted a copy of "${t.name}".` });
  }

  /** A condition in words for the save-as-template list: `"Do you smoke?" is Yes`. */
  function quotedCondition(c: Condition): string {
    const source = schema ? findBlock(schema.blocks, c.question)?.block : undefined;
    const label = source ? conditionAnswerOptions(source)?.find((o) => o.code === c.answer)?.label : undefined;
    const answer = c.operator === "exists" ? "" : ` ${label ?? c.answer}`;
    return `${source ? `"${blockName(source)}"` : "a missing question"} ${OPERATOR_TEXT[c.operator]}${answer}`;
  }

  /**
   * Select a block. From the keyboard (the card's Enter or Space), focus moves
   * on to its first field in the settings pane, as the author asked to edit it;
   * the pane's "Back to the canvas" returns it.
   */
  function selectBlock(bid: string, toPane: boolean) {
    setSelectedId(bid);
    // Title and Label blocks have no Label field: their first field is Text.
    const first = () => document.getElementById("block-label") ?? document.getElementById("block-content");
    if (toPane) requestAnimationFrame(() => requestAnimationFrame(() => first()?.focus()));
  }

  /**
   * Show Form settings: select nothing, which is what the pane shows them for. From
   * the top bar's Form settings (or its menu item), focus moves to the pane's
   * heading, so keyboard and screen-reader users land there; a click on empty
   * canvas space leaves focus where it was.
   */
  function showFormSettings(focusPane: boolean) {
    setSelectedId(null);
    if (focusPane) requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(SETTINGS_PANE_HEADING_ID)?.focus()));
  }

  /** From the pane back to the selected block's place on the canvas: its card, or a page's title. */
  function backToCanvas() {
    if (!selectedId) return;
    const escaped = selectedId.replace(/["\\]/g, "\\$&");
    const target =
      document.querySelector<HTMLElement>(`[data-block-id="${escaped}"] [data-select-block]`) ??
      document.querySelector<HTMLElement>(`[data-page-box="${escaped}"] input`);
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
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
   * Question names (contract §17.8). An existing question gets its name as soon
   * as it comes within reach of a scored group — a score added, a move, Repeats
   * turned off, a group removed but its contents kept, a template inserted. A
   * new question waits for its real label: it is in `newQuestions` until the
   * author leaves its label field after changing it, and the save names any
   * still without one. A name is never regenerated.
   */
  const newQuestions = useRef(new Set<string>());
  const withNames = (blocks: Block[]) => fillQuestionNames(blocks, { skip: newQuestions.current });
  /** Leaving a new question's label field after changing it: its name comes from that label. */
  function labelLeft(bid: string) {
    if (!newQuestions.current.delete(bid)) return;
    patch((s) => ({ ...s, blocks: fillQuestionNames(s.blocks, { only: new Set([bid]) }) }));
  }

  /*
   * A question's name is stored as typed, so its inline message shows. When the
   * author leaves the field with a valid name no other question in reach has,
   * every formula using the old one follows it (§17.9), and the field says how
   * many. A field left empty gets a name from the label at once, and the
   * formulas follow that. `nameOrigins` remembers the name the formulas still
   * use while the field holds something else, as `codeOrigins` does for codes.
   */
  const nameOrigins = useRef(new Map<string, string>());
  const [nameStatus, setNameStatus] = useState<{ blockId: string; text: string } | null>(null);
  function nameFocus(bid: string) {
    if (nameOrigins.current.has(bid) || !schema) return;
    const current = findBlock(schema.blocks, bid)?.block.name;
    nameOrigins.current.set(bid, typeof current === "string" ? current : "");
  }
  function nameLeave(bid: string) {
    if (!schema) return;
    const entry = findBlock(schema.blocks, bid);
    if (!entry) return;
    const typed = typeof entry.block.name === "string" ? entry.block.name.trim() : "";
    const taken = namesTakenFor(schema.blocks, bid);
    const from = nameOrigins.current.get(bid) ?? typed;
    const to = typed || generateQuestionName(entry.block.label ?? "", taken, questionNumbers(schema.blocks).get(bid) ?? 0);
    if (!NAME_PATTERN.test(to) || taken.includes(to.toLowerCase())) {
      if (typed !== entry.block.name) updateBlock(bid, { name: typed });
      return; // the inline message explains; the formulas keep `from`
    }
    nameOrigins.current.delete(bid);
    const { blocks, updated } = renameQuestion(schema.blocks, bid, from, to);
    patch((s) => ({ ...s, blocks }));
    setNameStatus(
      updated ? { blockId: bid, text: `${updated} ${updated === 1 ? "formula" : "formulas"} updated to use "${to}".` } : null,
    );
  }

  /** A group's scores changed (contract §17.9); the first score brings names to the questions it can reach. */
  function updateScores(gid: string, scores: Score[] | undefined) {
    patch((s) => ({ ...s, blocks: withNames(updateBlockInTree(s.blocks, gid, (b) => ({ ...b, scores }) as Block)) }));
  }

  /**
   * Refused because scores use the blocks in the way (contract §17.9): the
   * contract's message for each score, with links to their groups.
   */
  function refuseForScores(uses: ReturnType<typeof scoreDeletionBlockers>, before = ""): boolean {
    if (!uses.length) return false;
    const groups = uses.map((u) => u.group).filter((g, k, all) => all.findIndex((x) => x.id === g.id) === k);
    notify({ text: `${before}${uses.map(scoreUseMessage).join(" ")}`, blocks: groups });
    return true;
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
          notify({
            text: `Can't change the type of "${blockName(current)}" — these questions have conditions that depend on it:`,
            blocks: deps,
          });
          return;
        }
        // A formula can only use a question of a type that can be scored (contract §17.2, §17.9).
        if (refuseForScores(scoreTypeChangeBlockers(schema.blocks, bid, p.type), `Can't change the type of "${blockName(current)}". `)) return;
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
          notify({
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
      // An option's score (contract §17.9); clearing the field removes it.
      onScore: (i: number, score: number | undefined) => {
        const options = listOf(bid, ref);
        if (!options[i]) return;
        const { score: _old, ...rest } = options[i];
        options[i] = score === undefined ? rest : { ...rest, score };
        setList(bid, ref, options);
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
      notify({ text: `Choose a .csv or .txt file — "${file.name}" isn't one.` });
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
      notify({
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
      if (warning) setTypeChange({ blockId: bid, index: i, type, warning });
      else changeColumnType(bid, i, type);
    },
  });
  function changeColumnType(bid: string, i: number, type: GridColumnType) {
    forgetOrigins(bid);
    updateColumns(bid, (columns) => columns.map((c, k) => (k === i ? withColumnType(c, type) : c)));
  }

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
    notify({ text: "A group template holds exactly one group: it stays, and everything else goes inside it." });
    return true;
  }

  /**
   * Where focus goes when the block that had it is removed (its card's Delete,
   * or a dialog that card opened): the next block on the canvas, else the one
   * before, else the "+" that inserts one. Only if focus was in that card or
   * the dialog, so a deletion never moves focus away from somewhere else.
   */
  function keepFocusAfterRemoving(bid: string) {
    if (!schema) return;
    const active = document.activeElement;
    const inCard = !!active?.closest(`[data-block-id="${bid.replace(/["\\]/g, "\\$&")}"], [role="dialog"], [role="alertdialog"]`);
    if (!inCard) return;
    const rows = flattenVisible(schema.blocks, collapsed, null);
    const gone = new Set(walkBlocks(findBlock(schema.blocks, bid) ? [findBlock(schema.blocks, bid)!.block] : []).map((x) => x.block.id));
    const at = rows.findIndex((r) => r.id === bid);
    const after = rows.slice(at + 1).find((r) => !gone.has(r.id));
    const before = rows.slice(0, Math.max(at, 0)).reverse().find((r) => !gone.has(r.id));
    const to = (after ?? before)?.id;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const escaped = to?.replace(/["\\]/g, "\\$&");
        const target = to
          ? (document.querySelector<HTMLElement>(`[data-block-id="${escaped}"] [data-select-block]`) ??
            document.querySelector<HTMLElement>(`[data-page-box="${escaped}"] input`))
          : null;
        (target ?? insertRowRef.current?.querySelector<HTMLElement>("button"))?.focus();
      }),
    );
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
      notify({
        text: `Can't delete "${blockName(current)}" — these questions have conditions that depend on it:`,
        blocks: deps,
      });
      return;
    }
    if (refuseForScores(scoreDeletionBlockers(schema.blocks, bid))) return;
    newQuestions.current.delete(bid);
    keepFocusAfterRemoving(bid);
    patch((s) => ({ ...s, blocks: removeBlockFromTree(s.blocks, bid) }));
    setSelectedId((cur) => (cur === bid ? null : cur));
    say(`Deleted "${blockName(current)}".`);
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
    // A repeating group's questions may now be within reach of a scored group (contract §17.8).
    const group = findBlock(schema.blocks, gid)?.block;
    keepFocusAfterRemoving(gid);
    patch((s) => ({ ...s, blocks: withNames(unwrapGroup(s.blocks, gid)) }));
    setSelectedId((cur) => (cur === gid ? null : cur));
    say(`Deleted the group "${group ? blockName(group) : ""}". Its contents are where it was.`);
  }

  /** Delete a group and everything in it — refused while anything outside depends on something inside. */
  function deleteGroupWithContents(gid: string) {
    if (!schema) return;
    setDeletingGroupId(null);
    if (refuseRootChange(gid)) return;
    const group = findBlock(schema.blocks, gid)?.block;
    const deps = deletionBlockers(schema.blocks, gid);
    if (deps.length) {
      notify({
        text: `Can't delete "${group ? blockName(group) : "the group"}" and its questions — these questions outside it have conditions that depend on something inside it:`,
        blocks: deps,
      });
      return;
    }
    if (refuseForScores(scoreDeletionBlockers(schema.blocks, gid))) return;
    keepFocusAfterRemoving(gid);
    patch((s) => ({ ...s, blocks: removeBlockFromTree(s.blocks, gid) }));
    setSelectedId(null);
    say(`Deleted "${group ? blockName(group) : "the group"}" and its contents.`);
  }

  /**
   * Refuse a change to the tree's structure that would break conditions
   * (`structureBreaks`), naming the blocks it would break. `action` completes
   * "Can't …". Returns true when refused.
   */
  function refuseStructureEdit(breaks: { order: Block[]; prefix: Block[]; score: Block[] }, action: string): boolean {
    if (breaks.order.length) {
      notify({
        text: `Can't ${action} — these questions would end up before a question their conditions depend on:`,
        blocks: breaks.order,
      });
      return true;
    }
    if (breaks.prefix.length) {
      notify({
        text: `Can't ${action} — these blocks would have conditions on a question inside a repeating group they aren't in:`,
        blocks: breaks.prefix,
      });
      return true;
    }
    if (breaks.score.length) {
      notify({
        text: `Can't ${action} — these groups have scores whose formulas use a question that would be out of their reach:`,
        blocks: breaks.score,
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
  function tryMove(bid: string, target: MoveTarget, how = "") {
    if (!schema) return;
    if (refuseRootChange(bid, target)) return;
    const moving = findBlock(schema.blocks, bid)?.block;
    if (!moving) return;
    let next: Block[];
    try {
      next = moveBlockInTree(schema.blocks, bid, target.parentId, target.index);
    } catch (e) {
      notify({ text: (e as Error).message });
      return;
    }
    if (refuseStructureEdit(structureBreaks(schema.blocks, next), `move "${blockName(moving)}" there`)) return;
    if (target.parentId) expand(target.parentId);
    // A moved name already taken in a scored group's reach gets a suffix, and the
    // formulas that meant it follow (contract §17.9); questions newly in reach get names.
    const moved = new Set(walkBlocks([moving]).map((e) => e.block.id));
    const { blocks: resolved, renamed } = resolveNameClashes(schema.blocks, next, moved);
    patch((s) => ({ ...s, blocks: withNames(resolved) }));
    say(`Moved "${blockName(moving)}"${how}.`);
    if (renamed.length) {
      notify({
        tone: "info",
        text: renamed.map((r) => `"${r.from}" is already used there, so the moved question is now named "${r.to}".`).join(" "),
        blocks: renamed.map((r) => findBlock(resolved, r.id)!.block),
      });
    }
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
        notify({
          text: `Can't make "${blockName(group)}" repeat — these blocks outside it have conditions that use a question inside it:`,
          blocks: deps,
        });
        return;
      }
      // A score outside it can't use a question in a repeating group (contract §17.2, §17.9).
      const scored = repeatsOnScoreBlockers(schema.blocks, gid);
      if (scored.length) {
        notify({
          text: `Can't make "${blockName(group)}" repeat — these groups have scores whose formulas use a question inside it:`,
          blocks: scored,
        });
        return;
      }
      updateBlock(gid, { repeats: true, ...REPEAT_DEFAULTS, maxOccurs: undefined });
    } else {
      // Its questions may now be within reach of a scored group around it (contract §17.8).
      patch((s) => ({
        ...s,
        blocks: withNames(
          updateBlockInTree(s.blocks, gid, (b) => ({ ...b, repeats: undefined, repeatLabel: undefined, minOccurs: undefined, maxOccurs: undefined }) as Block),
        ),
      }));
    }
  }

  /*
   * Pages. The edits themselves, and their refusals, live in form-schema; a
   * refusal shows in the standard banner with links to the blocks in the way.
   */
  function applyPageEdit(edit: PageEdit): boolean {
    if (!edit.ok) {
      notify({ text: edit.message, blocks: edit.dependents.length ? edit.dependents : undefined });
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
    const page = newPage(allBlockIds(schema.blocks), newPageTitle(schema.blocks));
    patch((s) => ({ ...s, blocks: insertPageAfter(s.blocks, after, page) }));
    setSelectedId(page.id);
    say("Added a page.");
  }

  /** Wrap everything into Page 1 and add an empty Page 2 after it. */
  function convertToPages() {
    if (!schema) return;
    setConfirmPaging(false);
    const wrapped = makePaged(schema.blocks);
    const second = newPage(allBlockIds(wrapped), newPageTitle(wrapped));
    patch((s) => ({ ...s, blocks: insertPageAfter(wrapped, wrapped[0].id, second) }));
    setSelectedId(second.id);
    say("Split into pages: your questions are on Page 1, and Page 2 is empty.");
  }

  function movePageBy(pageId: string, direction: -1 | 1) {
    if (!schema) return;
    const page = findBlock(schema.blocks, pageId)?.block;
    if (applyPageEdit(movePage(schema.blocks, pageId, direction)) && page) say(`Moved "${blockName(page)}" ${direction === -1 ? "up" : "down"}.`);
  }

  function deletePageKeeping(pageId: string) {
    if (!schema) return;
    setDeletingPageId(null);
    const page = findBlock(schema.blocks, pageId)?.block;
    const edit = deletePageKeepingContents(schema.blocks, pageId);
    if (edit.ok) keepFocusAfterRemoving(pageId);
    if (applyPageEdit(edit)) {
      setSelectedId((cur) => (cur === pageId ? null : cur));
      say(`Deleted the page "${page ? blockName(page) : ""}". Its contents moved to the next page along.`);
    }
  }

  function deletePageAll(pageId: string) {
    if (!schema) return;
    setDeletingPageId(null);
    const page = findBlock(schema.blocks, pageId)?.block;
    const edit = deletePageWithContents(schema.blocks, pageId);
    if (edit.ok) keepFocusAfterRemoving(pageId);
    if (applyPageEdit(edit)) {
      setSelectedId(null);
      say(`Deleted the page "${page ? blockName(page) : ""}" and its contents.`);
    }
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
    say("Removed pages: the form is one page again.");
    if (switchDrafts) {
      notify({
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

  // The save's scoring rules (contract §17.6–§17.8), each shown under its field.
  const scoreIssues = useMemo(() => (schema ? scoreProblems(walkBlocks(schema.blocks)) : []), [schema]);

  if (loadError) {
    const back = templateMode ? { href: "/app/templates", label: "Back to Templates" } : { href: "/app", label: "Back to My forms" };
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-6">
        <Callout
          role="alert"
          tone="fail"
          title={templateMode ? "Couldn't load this template" : "Couldn't load this form"}
          className="w-full max-w-md"
          action={
            <Link href={back.href} className={buttonClasses({ size: "sm" })}>
              {back.label}
            </Link>
          }
        >
          It may have been deleted, or the address may be wrong. Open it again from the list.
        </Callout>
      </div>
    );
  }
  // Until the member arrives too: the pane's width comes with them, and it mustn't jump after the first paint.
  if (!schema || user.status === "loading")
    return <EditorSkeleton label={templateMode ? "Loading the template" : "Loading the form"} paneWidth={pane.width} />;

  // The standing note on a screen nothing can be saved from.
  const readOnlyNote =
    templateMode && template?.scope === "system"
      ? "This is a system template, so it can't be changed. Duplicate it from Templates to make your own copy."
      : viewer
        ? "You have view access, so changes here can't be saved."
        : null;

  const selectedEntry = selectedId ? findBlock(schema.blocks, selectedId) : undefined;
  const selected = selectedEntry?.block ?? null;
  // The same rule and message as the save (displayBlockProblem in form-schema).
  const selectedDisplayProblem = selectedEntry ? (displayBlockProblem(selectedEntry)?.message ?? null) : null;
  // A repeating group's settings: the save's rules and messages (repeatSettingsProblems), each under its field.
  const selectedRepeatProblems = selected ? repeatSettingsProblems(selected) : [];
  const repeatProblem = (field: "repeatLabel" | "minOccurs" | "maxOccurs") =>
    selectedRepeatProblems.find((p) => p.field === field)?.detail;
  // A scale's or a number's range: the save's rules and messages (rangeSettingsProblems), each under its field.
  const selectedRangeProblems = selected ? rangeSettingsProblems(selected) : [];
  const rangeProblem = (field: "min" | "max") => selectedRangeProblems.find((p) => p.field === field)?.detail;
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
          onSelect={(toPane) => selectBlock(item.id, toPane)}
          onDelete={() => removeBlock(item.id)}
          onMove={(direction) => {
            const target = direction === -1 ? step.up : step.down;
            if (target) tryMove(item.id, target, direction === -1 ? " up" : " down");
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
  // The pane's fields: one gap between them, and a section's rule above it.
  const paneField = "mb-3";
  const paneSection = "mb-4 border-t border-rule pt-3";

  return (
    <div className="flex h-screen flex-col bg-paper">
      {/* Top bar */}
      <header className="flex h-14 flex-none items-center gap-3 border-b border-rule bg-surface px-4">
        <LeaveLink
          href={templateMode ? "/app/templates" : "/app"}
          dirty={dirty}
          className={buttonClasses({ variant: "ghost", size: "icon", className: "h-9 w-9 flex-none text-graphite hover:text-ink" })}
          aria-label={templateMode ? "Back to templates" : "Back"}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </LeaveLink>
        {templateMode ? (
          <h1 className="flex min-w-0 items-center gap-2 font-display text-[0.9375rem] font-semibold tracking-[-0.008em]">
            <LayoutTemplate className="h-4 w-4 flex-none text-brand-deep" aria-hidden="true" />
            <span className="truncate">Template: {template?.name}</span>
            <StatusChip className="flex-none">{groupTemplate ? "Group" : "Form"}</StatusChip>
          </h1>
        ) : (
          <>
          {/* The page's one h1, for a screen reader's heading list; the title
              itself is the field beside it. */}
          <h1 className="sr-only">Edit form: {schema.title.trim() || "Untitled form"}</h1>
          <input
            value={schema.title}
            onChange={(e) => patch((s) => ({ ...s, title: e.target.value }))}
            // The canvas has a field for the same title; the names say which is which.
            aria-label="Form title in the top bar"
            // The one thing in the bar that shrinks, and the first to: below
            // 1024px the bar is tight, and Save must stay on screen.
            className="min-w-[7rem] max-w-[280px] shrink rounded-md border border-transparent px-2 py-1 font-display text-[0.9375rem] font-semibold tracking-[-0.008em] outline-none transition-colors duration-200 hover:bg-paper-sunk focus:border-brand-deep focus:bg-surface focus:ring-[3px] focus:ring-brand/20"
            spellCheck={false}
          />
          </>
        )}
        {readOnly ? (
          <StatusChip tone="locked" className="flex-none">
            View only
          </StatusChip>
        ) : (
          <SaveStatus state={saving ? "saving" : dirty ? "dirty" : "saved"} announcement={saveAnnouncement.text} />
        )}

        <div className="ml-auto flex flex-none items-center gap-2">
          {/* From 1024px: everything in the bar. Below it, Form settings, Download,
              the theme and the form's actions move into one ⋯ menu, so Save, Cancel
              and the save state stay on screen (restyle 4). */}
          {/* A group template has no form settings. */}
          {!groupTemplate && (
            <Button size="sm" onClick={() => showFormSettings(true)} aria-controls={SETTINGS_PANE_ID} className="hidden lg:inline-flex">
              <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
              Form settings
            </Button>
          )}
          <ThemeToggle className="hidden lg:inline-flex" />
          {!templateMode && (
            <>
              <Button size="sm" onClick={onDownload} pending={downloading} pendingLabel="Download" title="Download the latest saved version" className="hidden lg:inline-flex">
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                Download
              </Button>
              {canEdit && (
                <div className="hidden lg:block">
                  <MenuButton
                    label="More form actions"
                    className={buttonClasses({ size: "sm", className: "px-2" })}
                    items={[{ label: "Save form as template…", icon: LayoutTemplate, onSelect: () => setSavingAsTemplate({ kind: "form" }) }]}
                  />
                </div>
              )}
            </>
          )}
          <div className="lg:hidden">
            <MenuButton
              label={templateMode ? "More actions" : "More form actions"}
              className={buttonClasses({ size: "sm", className: "px-2" })}
              items={[
                ...(groupTemplate
                  ? []
                  : [
                      { label: "Form settings", icon: SlidersHorizontal, onSelect: () => showFormSettings(true) },
                      ...(templateMode ? ["separator" as const] : []),
                    ]),
                ...(templateMode
                  ? []
                  : [
                      { label: downloading ? "Downloading…" : "Download", icon: Download, onSelect: onDownload },
                      ...(canEdit ? [{ label: "Save form as template…", icon: LayoutTemplate, onSelect: () => setSavingAsTemplate({ kind: "form" }) }] : []),
                      "separator" as const,
                    ]),
                // The same choices as the ThemeToggle it replaces here.
                ...THEME_CHOICES.map(({ value, label, Icon }) => ({
                  label: `${label} theme`,
                  icon: Icon,
                  checked: theme === value,
                  onSelect: () => chooseTheme(value),
                })),
              ]}
            />
          </div>
          {!readOnly && (
            <>
              {(!dirty || saving) && (
                // Visually hidden below 1024px, where the save state beside the
                // title says the same; still Cancel's and Save's description.
                <span id={saveReasonId} className="sr-only text-[0.6875rem] text-graphite lg:not-sr-only">
                  {saving ? "Saving your changes…" : "No changes to save"}
                </span>
              )}
              <Button size="sm" onClick={onCancel} reasonId={!dirty || saving ? saveReasonId : undefined}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={onSave}
                pending={saving}
                reasonId={!dirty && !saving ? saveReasonId : undefined}
              >
                Save
              </Button>
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
      {confirmingCancel && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          consequence="Your edits since the last save will be lost. This can't be undone."
          confirmLabel="Discard changes"
          onConfirm={async () => discardChanges()}
          onClose={() => setConfirmingCancel(false)}
        />
      )}
      {typeChange && (
        <ConfirmDialog
          // The warning is a question and its consequence: 'Change "X" to short text? Its 3 options will be removed.'
          title={`${typeChange.warning.split("? ")[0]}?`}
          consequence={typeChange.warning.split("? ").slice(1).join("? ")}
          confirmLabel="Change to short text"
          onConfirm={async () => changeColumnType(typeChange.blockId, typeChange.index, typeChange.type)}
          onClose={() => setTypeChange(null)}
        />
      )}
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
            toast.show({ tone: "pass", title: `Saved "${t.name}" to your organisation's templates.` });
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

      <div role="status" aria-live="polite" className="sr-only" data-editor-announcement>
        <span key={said.n}>{said.text}</span>
      </div>

      {((readOnlyNote && !readOnlyNoteDismissed) || notice) && (
        <div className="flex flex-none flex-col gap-2 border-b border-rule bg-paper px-4 py-2.5">
          {readOnlyNote && !readOnlyNoteDismissed && (
            <Callout role="status" tone="info" title={readOnlyNote} onDismiss={() => setReadOnlyNoteDismissed(true)} />
          )}
          {notice && (
            <Callout
              key={notice.id}
              // Nothing else announces these: a refusal or a failure interrupts, a note waits.
              role={notice.tone === "info" ? "status" : "alert"}
              tone={notice.tone}
              title={notice.text}
              onDismiss={() => setNotice(null)}
              action={
                notice.blocks?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {notice.blocks.map((b) => (
                      <Button key={b.id} size="sm" onClick={() => jumpTo(b.id)}>
                        {blockName(b)} →
                      </Button>
                    ))}
                  </div>
                ) : undefined
              }
            />
          )}
        </div>
      )}

      {/* Body */}
      <div
        className="grid min-h-0 flex-1"
        // The handle sits in a zero-width column between the canvas and the settings pane.
        style={{ gridTemplateColumns: `minmax(0,1fr) 0px ${pane.width}px` }}
      >
        {/* Canvas: the page's main landmark. */}
        <main
          className="overflow-auto bg-paper px-6 py-8"
          // A click on empty canvas space, around the form or inside it between blocks,
          // shows Form settings. Keyboard users have the top bar's Form settings.
          onClick={(e) => {
            if ((e.target as HTMLElement).hasAttribute("data-canvas-blank")) showFormSettings(false);
          }}
          data-canvas-blank
        >
          <div className="mx-auto max-w-[680px]" data-canvas-blank>
            <div className="surface p-8" data-canvas-blank>
              {groupTemplate ? (
                // A group template has no title or description of its own: it is its group.
                <p className="body-sm text-graphite">
                  This group template is the group below. Everything in it goes inside the group.
                </p>
              ) : (
                <>
                  <input
                    value={schema.title}
                    onChange={(e) => patch((s) => ({ ...s, title: e.target.value }))}
                    onFocus={() => setSelectedId(null)}
                    aria-label={templateMode ? "Form title (in forms made from this template)" : "Form title on the canvas"}
                    className="-mx-2 w-[calc(100%+1rem)] rounded-lg border border-transparent bg-transparent px-2 font-display text-[1.625rem] font-bold tracking-[-0.02em] text-ink outline-none transition-colors duration-200 ease-out-expo hover:bg-paper-sunk focus:border-brand-deep focus:bg-surface focus:ring-[3px] focus:ring-brand/20"
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
                    className="-mx-2 mt-1 w-[calc(100%+1rem)] rounded-lg border border-transparent bg-transparent px-2 py-0.5 text-[0.9375rem] text-graphite outline-none transition-colors duration-200 ease-out-expo placeholder:text-graphite-soft hover:bg-paper-sunk focus:border-brand-deep focus:bg-surface focus:ring-[3px] focus:ring-brand/20"
                    spellCheck={false}
                  />
                </>
              )}

              <div className="mt-6" data-canvas-blank>
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
                  // The handles are for the pointer; this is what a screen reader hears if it reaches one.
                  accessibility={{
                    screenReaderInstructions: {
                      draggable:
                        "To move a block from the keyboard, select it and use Move up, Move down or Move to… in its settings, or the Move up and Move down buttons on its card.",
                    },
                  }}
                >
                  <SortableContext items={rows.map((r) => r.id)} strategy={noDisplacement}>
                    <div className="relative flex flex-col gap-2.5" data-canvas-blank>
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
                  type="button"
                  onClick={() => openMenu()}
                  className={buttonClasses({ size: "icon", className: "h-7 w-7 flex-none p-0 text-graphite ease-out-expo hover:text-ink" })}
                  title="Insert a block"
                  aria-label="Insert a block"
                  aria-haspopup="listbox"
                  aria-expanded={menuOpen}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                </button>
                {(() => {
                  const hint = autoTargetGroup
                    ? `Type / to add a block to "${
                        blockName(autoTargetGroup).trim() || (isPage(autoTargetGroup) ? "this page" : "this group")
                      }", or click +`
                    : "Type / to insert a block, or click +";
                  return (
                    <input
                      value=""
                      onChange={() => {}}
                      onKeyDown={(e) => {
                        if (e.key === "/") {
                          e.preventDefault();
                          openMenu();
                        }
                      }}
                      placeholder={hint}
                      // Its only key is "/"; the name says so, as the placeholder does.
                      aria-label={hint}
                      className="flex-1 bg-transparent text-[0.875rem] text-ink outline-none placeholder:text-graphite-soft"
                      spellCheck={false}
                    />
                  );
                })()}
              </div>

              {!groupTemplate && (
                <button
                  type="button"
                  onClick={addPage}
                  className={buttonClasses({ variant: "ghost", size: "sm", className: "mt-2 text-graphite ease-out-expo hover:text-brand-deep" })}
                >
                  <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                  {addPageAfter ? `Add page after "${addPageAfter.title.trim() || "Untitled page"}"` : "Add page"}
                </button>
              )}

              {schema.blocks.length === 0 && (
                <div className="mt-4 flex flex-col items-center gap-1.5 rounded-[0.875rem] border border-dashed border-rule-strong px-6 py-10 text-center">
                  <span className="font-display text-[1.0625rem] font-semibold tracking-[-0.015em] text-ink">Add your first block</span>
                  <span className="body-sm max-w-[52ch] text-graphite">
                    Type <kbd className="rounded border border-rule-strong bg-paper-sunk px-1.5 font-mono text-[0.75rem] text-ink">/</kbd>{" "}
                    above or click + to choose from {CATALOG_BLOCK_COUNT} block types.
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={closeMenu} />
            <BlockMenu query={menuQuery} onQuery={setMenuQuery} onPick={insertFromCatalog} onClose={closeMenu} pos={menuAnchor} />
          </>
        )}

        {/* Inspector */}
        <SettingsPaneHandle pane={pane} />
        <aside
          id={SETTINGS_PANE_ID}
          // Named by whichever heading it shows; the handle uses the same one.
          aria-labelledby={SETTINGS_PANE_HEADING_ID}
          className="overflow-auto border-l border-rule bg-surface p-4"
        >
          {selected ? (
            <div key={selected.id}>
              {/* Shown on focus: the way back to this block on the canvas, after a keyboard selection. */}
              <button
                type="button"
                onClick={backToCanvas}
                className={cn(
                  "sr-only focus:not-sr-only",
                  buttonClasses({ variant: "ghost", size: "sm", className: "focus:-ml-2.5 focus:mb-2" }),
                )}
              >
                <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" /> Back to the canvas
              </button>
              <h2 id={SETTINGS_PANE_HEADING_ID} className="eyebrow mb-3 text-graphite-soft">
                {inspectorHeading(selected)}
              </h2>
              {/* Title and Label blocks have one field, Text, below: their label follows it. */}
              {!TEXT_ONLY_TYPES.includes(selected.type) && (
                <Field
                  id="block-label"
                  label={isPage(selected) ? "Title" : "Label"}
                  optional={false}
                  hint={
                    selected.type === "image"
                      ? "Also read aloud to screen-reader users — describe what the image shows."
                      : selected.type === "video"
                        ? "Read aloud to screen-reader users — describe what the video is about."
                        : selected.type === "audio"
                          ? "Read aloud to screen-reader users — say what the recording is."
                          : undefined
                  }
                  className={paneField}
                >
                  {(field) => (
                    <Input
                      {...field}
                      value={blockName(selected)}
                      onChange={(e) =>
                        updateBlock(selected.id, isPage(selected) ? { title: e.target.value } : { label: e.target.value })
                      }
                      onFocus={(e) => (e.currentTarget.dataset.atFocus = e.currentTarget.value)}
                      onBlur={(e) => {
                        if (e.currentTarget.value !== e.currentTarget.dataset.atFocus) labelLeft(selected.id);
                      }}
                    />
                  )}
                </Field>
              )}

              {/* A question's name, for score formulas (contract §17.8): only within reach of a scored group. */}
              {isAnswerable(selected) && isWithinScoreReach(schema.blocks, selected.id) && (() => {
                const problem = scoreIssues.find((p) => p.blockId === selected.id && p.field === "name")?.detail;
                const status = nameStatus?.blockId === selected.id ? nameStatus.text : null;
                return (
                  <div className={paneField}>
                    <Field
                      id="block-name"
                      label="Name"
                      optional={false}
                      hint="Used in score formulas. Lower-case letters, digits and _, starting with a letter."
                      error={problem}
                      liveError
                      describedBy="block-name-status"
                    >
                      {(field) => (
                        <Input
                          {...field}
                          mono
                          value={typeof selected.name === "string" ? selected.name : ""}
                          placeholder={newQuestions.current.has(selected.id) ? "Given when you set the label" : undefined}
                          spellCheck={false}
                          autoCapitalize="off"
                          autoComplete="off"
                          onFocus={() => nameFocus(selected.id)}
                          onChange={(e) => {
                            updateBlock(selected.id, { name: e.target.value });
                            setNameStatus(null);
                          }}
                          onBlur={() => nameLeave(selected.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                        />
                      )}
                    </Field>
                    <p id="block-name-status" role="status" aria-live="polite" className="mt-1 text-[0.75rem] text-ink">
                      {status}
                    </p>
                  </div>
                );
              })()}

              {/* Repeating groups (contract §12): groups only, never pages. */}
              {isGroup(selected) && (
                <div className={paneSection}>
                  <div className="flex items-center justify-between text-[0.8125rem] font-medium">
                    <span id="repeats-label">Repeats</span>
                    <Switch
                      checked={!!selected.repeats}
                      aria-labelledby="repeats-label"
                      aria-describedby="repeats-help"
                      onChange={(on) => setRepeats(selected.id, on)}
                    />
                  </div>
                  <p id="repeats-help" className="mt-1 text-[0.75rem] text-graphite">
                    Respondents fill this group&apos;s questions once per entry, and can add and remove entries.
                  </p>

                  {isRepeatingGroup(selected) && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div>
                        <Field
                          id="repeat-label"
                          label="Name for one entry"
                          optional={false}
                          hint={
                            <>
                              Write it as it would appear mid-sentence, e.g. <em>patient</em>. Use lower case unless
                              it&apos;s a name or acronym.
                            </>
                          }
                          error={repeatProblem("repeatLabel")}
                          errorRole="alert"
                          describedBy={repeatPreviewText(selected.repeatLabel) ? "repeat-label-preview" : undefined}
                        >
                          {(field) => (
                            <Input
                              {...field}
                              value={selected.repeatLabel ?? ""}
                              onChange={(e) => updateBlock(selected.id, { repeatLabel: e.target.value })}
                            />
                          )}
                        </Field>
                        {repeatPreviewText(selected.repeatLabel) && (
                          <p
                            id="repeat-label-preview"
                            className="mt-1.5 rounded-md bg-paper-sunk px-2 py-1 text-[0.75rem] text-ink"
                          >
                            {repeatPreviewText(selected.repeatLabel)}
                          </p>
                        )}
                      </div>

                      {(
                        [
                          ["minOccurs", "Minimum entries", "1", "0 lets the respondent remove every entry."],
                          ["maxOccurs", "Maximum entries", "No limit", "Leave blank for no limit."],
                        ] as const
                      ).map(([field, label, placeholder, help]) => (
                        <Field
                          key={field}
                          id={`repeat-${field}`}
                          label={label}
                          optional={false}
                          hint={help}
                          error={repeatProblem(field)}
                          errorRole="alert"
                        >
                          {(props) => (
                            <Input
                              {...props}
                              type="number"
                              inputMode="numeric"
                              min={field === "minOccurs" ? 0 : 1}
                              step={1}
                              value={selected[field] ?? ""}
                              placeholder={placeholder}
                              onChange={(e) => updateBlock(selected.id, { [field]: parseCount(e.target.value) })}
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Scores (contract §17): groups only, plain or repeating, never pages. */}
              {isGroup(selected) && (
                <ScoresPanel
                  key={`scores-${selected.id}`}
                  group={selected}
                  blocks={schema.blocks}
                  problems={scoreIssues.filter((p) => p.group === selected.id)}
                  onChange={(scores) => updateScores(selected.id, scores)}
                  onJump={jumpTo}
                />
              )}
              {/*
                Help text only where the renderer shows it: on questions. Not on pages,
                groups or display blocks (contract §1, §9–§11); a value already stored on one
                is left alone. Cleared help text is removed, never stored as "".
              */}
              {isAnswerable(selected) && (
                // Its own span, so the label's text is "Help text" whatever the optional marker says.
                <Field id="block-help" label={<span>Help text</span>} optional className="mb-4">
                  {(field) => (
                    <Input
                      {...field}
                      value={selected.description ?? ""}
                      onChange={(e) => updateBlock(selected.id, { description: e.target.value || undefined })}
                    />
                  )}
                </Field>
              )}

              {selected.type === "text" && (
                <Field
                  id="block-content"
                  label="Content"
                  optional={false}
                  error={selectedDisplayProblem}
                  errorRole="alert"
                  className="mb-4"
                >
                  {(field) => (
                    <Textarea
                      {...field}
                      value={selected.content ?? ""}
                      onChange={(e) => updateBlock(selected.id, { content: e.target.value })}
                      rows={3}
                      className="resize-none"
                    />
                  )}
                </Field>
              )}

              {/*
                A Title's or Label's one field: what respondents see. The label follows it
                (textFieldEdit); blank, respondents see the label, which the placeholder shows.
              */}
              {TEXT_ONLY_TYPES.includes(selected.type) && (
                <Field id="block-content" label="Text" optional={false} className="mb-4">
                  {(field) => (
                    <Input
                      {...field}
                      value={selected.content ?? ""}
                      placeholder={selected.label}
                      onChange={(e) => updateBlock(selected.id, textFieldEdit(selected, e.target.value))}
                    />
                  )}
                </Field>
              )}

              {["image", "video", "audio"].includes(selected.type) && (
                <Field
                  id="block-url"
                  label="URL"
                  optional={false}
                  // Audio-only content needs a text alternative (contract §11, WCAG 1.2.1).
                  hint={selected.type === "audio" ? "Add a transcript in a Text block next to it so everyone can follow." : undefined}
                  error={selectedDisplayProblem}
                  errorRole="alert"
                  className="mb-4"
                >
                  {(field) => (
                    <Input
                      {...field}
                      mono
                      value={selected.content ?? ""}
                      onChange={(e) => updateBlock(selected.id, { content: e.target.value })}
                      placeholder={
                        selected.type === "image"
                          ? "https://… or a path on your app's server, e.g. /images/logo.png"
                          : selected.type === "video"
                            ? "YouTube or Vimeo link, or an .mp4 / .webm address"
                            : "An .mp3, .m4a, .ogg or .wav address"
                      }
                      className="text-[0.8125rem]"
                    />
                  )}
                </Field>
              )}

              {selected.type === "heading" && (
                <div className="mb-4">
                  <span id="heading-level-label" className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
                    Level
                  </span>
                  <HeadingLevel
                    labelledBy="heading-level-label"
                    value={selected.level || 2}
                    onChange={(level) => updateBlock(selected.id, { level })}
                  />
                </div>
              )}

              {/* A scale's first and last points (contract §6, builder only: rangeSettingsProblems). */}
              {selected.type === "scale" && (
                <div className="mb-4">
                  <div className="grid grid-cols-2 items-start gap-2">
                    <Field id="scale-min" label="Min" optional={false} error={rangeProblem("min")} errorRole="alert" describedBy="scale-range-help">
                      {(field) => (
                        <Input
                          {...field}
                          type="number"
                          step={1}
                          value={selected.min ?? SCALE_DEFAULTS.min}
                          onChange={(e) => updateBlock(selected.id, { min: Number(e.target.value) })}
                        />
                      )}
                    </Field>
                    <Field id="scale-max" label="Max" optional={false} error={rangeProblem("max")} errorRole="alert" describedBy="scale-range-help">
                      {(field) => (
                        <Input
                          {...field}
                          type="number"
                          step={1}
                          value={selected.max ?? SCALE_DEFAULTS.max}
                          onChange={(e) => updateBlock(selected.id, { max: Number(e.target.value) })}
                        />
                      )}
                    </Field>
                  </div>
                  <p id="scale-range-help" className="mt-1.5 text-[0.75rem] leading-relaxed text-graphite">
                    Whole numbers. Respondents see every point from Min to Max, at most {SCALE_MAX_POINTS}.
                  </p>
                </div>
              )}

              {/* A number's limits, both optional (contract §6, builder only: rangeSettingsProblems). */}
              {selected.type === "number" && (
                <div className="mb-4">
                  <div className="grid grid-cols-2 items-start gap-2">
                    {(
                      [
                        ["min", "Minimum"],
                        ["max", "Maximum"],
                      ] as const
                    ).map(([key, label]) => (
                      <Field
                        key={key}
                        id={`number-${key}`}
                        label={label}
                        optional
                        error={rangeProblem(key)}
                        errorRole="alert"
                        describedBy="number-range-help"
                      >
                        {(field) => (
                          <Input
                            {...field}
                            type="number"
                            step="any"
                            inputMode="decimal"
                            value={selected[key] ?? ""}
                            onChange={(e) => updateBlock(selected.id, { [key]: parseCount(e.target.value) })}
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                  <p id="number-range-help" className="mt-1.5 text-[0.75rem] leading-relaxed text-graphite">
                    Leave blank for no limit. Decimals and negative numbers are allowed.
                  </p>
                </div>
              )}

              {/* Coded lists (contract §13): options, or a matrix's rows and columns. */}
              {OPTION_TYPES.includes(selected.type) &&
                ([
                  [{ list: "options" }, selected.type === "matrix" ? "Rows" : "Options", selected.type === "matrix" ? "row" : "option", selected.type === "matrix" ? "Row" : "Option"],
                  ...(selected.type === "matrix" ? [[{ list: "columns" }, "Columns", "column", "Column"]] : []),
                ] as [OptionListRef, string, string, "Option" | "Row" | "Column"][]).map(([ref, heading, noun, placeholder]) => (
                  <OptionListEditor
                    key={ref.list}
                    idPrefix={ref.list}
                    heading={heading}
                    noun={noun}
                    options={optionListAt(selected, ref)}
                    problems={optionListProblems(selected).filter((p) => sameOptionList(p, ref))}
                    status={listStatus(selected.id, ref)}
                    showScores={scoredOptionList(selected)?.list === ref.list && isWithinScoreReach(schema.blocks, selected.id)}
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
                    <div className="flex items-center justify-between border-t border-rule py-3 text-[0.8125rem] font-medium">
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
                      <div className="border-t border-rule py-3 text-[0.8125rem]">
                        <div className="flex items-center justify-between font-medium">
                          <span id="complete-label">{completeLabel}</span>
                          <Switch
                            checked={complete}
                            aria-labelledby="complete-label"
                            aria-describedby="complete-help"
                            onChange={(on) => updateBlock(selected.id, { completeRequired: on || undefined })}
                          />
                        </div>
                        <p id="complete-help" className="mt-1 text-[0.75rem] text-graphite">
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
                  <Button onClick={removePages} size="sm" className="mt-3 w-full">
                    Remove pages
                  </Button>
                ) : (
                  <Button onClick={() => setDeletingPageId(selected.id)} variant="danger" size="sm" className="mt-3 w-full">
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Delete page…
                  </Button>
                ))}
              {isGroup(selected) && !(groupTemplate && selected.id === schema.blocks[0]?.id) && (
                <Button onClick={() => setDeletingGroupId(selected.id)} variant="danger" size="sm" className="mt-3 w-full">
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Delete group…
                </Button>
              )}
            </div>
          ) : groupTemplate ? (
            <div>
              <h2 id={SETTINGS_PANE_HEADING_ID} className="eyebrow mb-3 text-graphite-soft">
                Group template
              </h2>
              <p className="body-sm text-graphite">
                A group template has no form settings: forms it&apos;s inserted into keep their own. Select a block to edit it.
              </p>
            </div>
          ) : (
            <div>
              {/* Focused by the top bar's Form settings: a target, not a tab stop. */}
              <h2 id={SETTINGS_PANE_HEADING_ID} tabIndex={-1} className="eyebrow mb-3 text-graphite-soft outline-none">
                Form settings
              </h2>
              {paged && (
                <>
                  <h3 className="mb-2 text-[0.8125rem] font-medium text-ink">Navigation</h3>
                  <label className="flex items-start gap-2.5">
                    <Checkbox
                      checked={schema.navigation?.showProgress ?? NAVIGATION_DEFAULTS.showProgress}
                      onChange={(e) => updateNavigation({ showProgress: e.target.checked })}
                      className="-mt-0.5"
                    />
                    <span>
                      <span className="block text-[0.8125rem] font-medium text-ink">Show progress</span>
                      <span className="block text-[0.75rem] text-graphite">
                        Shows &lsquo;Step 2 of 5&rsquo; above each page title
                      </span>
                    </span>
                  </label>
                  {/* Kept (not reset) while progress is off, so it comes back as it was. */}
                  <fieldset
                    disabled={!showProgress}
                    className={cn("ml-[34px] mt-2.5", !showProgress && "text-graphite-soft")}
                  >
                    <legend className="text-[0.8125rem] font-medium">Progress style</legend>
                    {(
                      [
                        ["caption", "Text only (“Step 2 of 5”)"],
                        ["bar", "Bar and text"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="mt-1.5 flex items-center gap-2 text-[0.8125rem]">
                        <input
                          type="radio"
                          name="progress-style"
                          value={value}
                          checked={progressStyle === value}
                          onChange={() => updateNavigation({ progressStyle: value })}
                          className="h-4 w-4 accent-brand-deep"
                        />
                        {label}
                      </label>
                    ))}
                    <span className="mt-1 block text-[0.75rem] text-graphite">
                      The client&apos;s app can override this with its own setting.
                    </span>
                  </fieldset>
                  <label className="mt-3 flex items-start gap-2.5">
                    <Checkbox
                      checked={schema.navigation?.reviewPage ?? NAVIGATION_DEFAULTS.reviewPage}
                      onChange={(e) => updateNavigation({ reviewPage: e.target.checked })}
                      className="-mt-0.5"
                    />
                    <span>
                      <span className="block text-[0.8125rem] font-medium text-ink">Review page before submit</span>
                      <span className="block text-[0.75rem] text-graphite">
                        Respondents check their answers before submitting
                      </span>
                    </span>
                  </label>
                </>
              )}

              {/* Where unfinished answers are kept: docs/DRAFTS-CONTRACT.md §2. */}
              <fieldset className={paged ? "mt-5" : undefined}>
                <legend className="mb-2 text-[0.8125rem] font-medium text-ink">Save progress</legend>
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
                    <label key={mode} className="mt-2 flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="draft-mode"
                        value={mode}
                        checked={(schema.drafts?.mode ?? DEFAULT_DRAFT_MODE) === mode}
                        disabled={!available}
                        onChange={() => updateDrafts(mode)}
                        className="mt-0.5 h-4 w-4 flex-none accent-brand-deep disabled:cursor-not-allowed"
                      />
                      <span>
                        <span className={cn("block text-[0.8125rem] font-medium", available ? "text-ink" : "text-graphite-soft")}>{label}</span>
                        <span className={cn("block text-[0.75rem]", available ? "text-graphite" : "text-graphite-soft")}>{help}</span>
                        {!available && (
                          <span className="mt-0.5 block text-[0.75rem] font-medium text-ink">Available for forms with pages</span>
                        )}
                      </span>
                    </label>
                  );
                })}
                <p className="mt-2.5 text-[0.75rem] text-graphite">
                  If the app hasn&apos;t been set up for the option chosen, the form falls back to &lsquo;Only while
                  the form is open&rsquo;.
                </p>
              </fieldset>

              <EmptyState
                className="mt-6 px-4 py-8"
                title="Nothing selected"
                body="Select a question to edit it, or add one from the canvas."
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
