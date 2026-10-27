/*
 * The editor's insert menu: which blocks it offers, and how its search matches them.
 */

import { BLOCK_META, type AnyBlockType } from "@formbuilder/form-schema";

export type CatalogItem = {
  // Pages are added with their own control, never from the block menu.
  type: Exclude<AnyBlockType, "page">;
  label?: string;
  keywords?: string;
  level?: number;
  /** "From template…": opens the template picker instead of adding a block. */
  template?: true;
};

export type CatalogGroup = { group: string; items: CatalogItem[] };

/**
 * The slash-menu block catalog, grouped by category. Hidden field isn't
 * offered: the renderer neither shows it nor collects or submits a value yet.
 * Blocks of that type already in a form still open, save and delete.
 */
export const CATALOG: CatalogGroup[] = [
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
    group: "Media",
    items: [
      { type: "image", keywords: "picture photo" },
      { type: "video", keywords: "youtube vimeo mp4 webm" },
      { type: "audio", keywords: "sound" },
    ],
  },
  {
    group: "Advanced",
    items: [
      // Respondents pick from a list: nothing about their location is detected.
      { type: "country", keywords: "nation" },
    ],
  },
];

export function catalogLabel(item: CatalogItem): string {
  return item.label ?? (item.type === "group" ? "Group" : BLOCK_META[item.type].label);
}

/** The groups and items the search box keeps for `query`: by label, keywords or type, ignoring case. */
export function matchCatalog(query: string, catalog: readonly CatalogGroup[] = CATALOG): CatalogGroup[] {
  const q = query.trim().toLowerCase();
  return catalog
    .map((g) => ({
      group: g.group,
      items: g.items.filter((it) => {
        if (!q) return true;
        const label = catalogLabel(it).toLowerCase();
        return label.includes(q) || (it.keywords || "").includes(q) || it.type.includes(q);
      }),
    }))
    .filter((g) => g.items.length > 0);
}

/** How many block types the menu offers, for the empty canvas ("choose from N block types"). */
export const CATALOG_BLOCK_COUNT = CATALOG.reduce((n, g) => n + g.items.filter((it) => !it.template).length, 0);
