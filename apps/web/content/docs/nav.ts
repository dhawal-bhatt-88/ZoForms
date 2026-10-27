/**
 * The docs' side navigation, in reading order. Pages are listed here rather
 * than found by folder, so a page's place is a decision and not an accident of
 * its file name.
 *
 * - `live`: has a file at content/docs/<slug>.mdx, and appears in the side
 *   navigation, search, llms.txt and the previous / next links.
 * - `planned`: not written yet. Recorded here so what we know about it isn't
 *   lost; nothing renders it, and a section or group with no live page is not
 *   shown.
 *
 * This folder is plain content (MDX, the example forms and this file) with no
 * imports from the app, so it can move to a separate site later.
 */

export type DocsNavPage = {
  title: string;
  /** The path under /docs, e.g. "build/question-types/dropdown". */
  slug: string;
  status: "live" | "planned";
  /** For a planned page: what it must say, and where that came from. */
  notes?: string;
};

export type DocsNavGroup = { title: string; pages: DocsNavPage[] };

export type DocsNavSection = { title: string; items: (DocsNavPage | DocsNavGroup)[] };

/** The docs home, first in reading order and above the sections. */
export const DOCS_HOME: DocsNavPage = { title: "Docs home", slug: "", status: "live" };

export const DOCS_NAV: DocsNavSection[] = [
  {
    title: "Build forms",
    items: [
      {
        title: "Question types",
        pages: [
          { title: "Dropdown", slug: "build/question-types/dropdown", status: "live" },
          { title: "Short answer", slug: "build/question-types/short-answer", status: "live" },
          { title: "Long answer", slug: "build/question-types/long-answer", status: "live" },
          { title: "Multiple choice", slug: "build/question-types/multiple-choice", status: "live" },
          { title: "Checkboxes", slug: "build/question-types/checkboxes", status: "live" },
          { title: "Number", slug: "build/question-types/number", status: "live" },
          { title: "Email", slug: "build/question-types/email", status: "live" },
          { title: "Phone number", slug: "build/question-types/phone-number", status: "live" },
          { title: "Link", slug: "build/question-types/link", status: "live" },
          { title: "Date", slug: "build/question-types/date", status: "live" },
          { title: "Time", slug: "build/question-types/time", status: "live" },
          { title: "Linear scale", slug: "build/question-types/linear-scale", status: "live" },
          { title: "Grid", slug: "build/question-types/grid", status: "live" },
          { title: "Matrix", slug: "build/question-types/matrix", status: "live" },
          { title: "Rating", slug: "build/question-types/rating", status: "live" },
          { title: "Ranking", slug: "build/question-types/ranking", status: "live" },
          { title: "Respondent's country", slug: "build/question-types/respondents-country", status: "live" },
        ],
      },
      {
        title: "Layout and media",
        pages: [
          { title: "Layout blocks", slug: "build/layout-and-media/layout-blocks", status: "live" },
          { title: "Image", slug: "build/layout-and-media/image", status: "live" },
          { title: "Video", slug: "build/layout-and-media/video", status: "live" },
          { title: "Audio", slug: "build/layout-and-media/audio", status: "live" },
        ],
      },
      {
        title: "Structure",
        pages: [
          { title: "Groups", slug: "build/structure/groups", status: "live" },
          { title: "Repeating groups", slug: "build/structure/repeating-groups", status: "live" },
          { title: "Pages, progress and review", slug: "build/structure/pages", status: "live" },
        ],
      },
      { title: "Show a question only when it applies", slug: "build/show-questions-conditionally", status: "live" },
    ],
  },
  {
    title: "Integrate forms",
    items: [
      {
        title: "Quickstart",
        slug: "integrate/quickstart",
        status: "planned",
        notes:
          "The home page's FAQ sends developers here: install @zoworkhq/forms, render the form file, write the endpoint that receives the answers.",
      },
      {
        title: "How-to guides",
        pages: [
          {
            title: "Styling: your app's CSS and the form",
            slug: "integrate/styling",
            status: "planned",
            notes: [
              "The renderer's default stylesheet has zero specificity by design (every rule in :where()), so a host page's own element rules win.",
              "Found on 23 Oct 2026: the external test app's `h1, h2` colour rule hid the form's group headings in dark mode.",
              "Changing --zf-* properties does not help, because the host's rule beats the renderer's rule whatever value it reads.",
              "Show the two real fixes: give the host's headings a colour that works in both themes, or scope the host rule so it doesn't reach inside .zf-form.",
              "Check the class names against the renderer's README before writing.",
            ].join(" "),
          },
        ],
      },
      {
        title: "Reference",
        pages: [
          { title: "FormRenderer", slug: "integrate/reference/form-renderer", status: "live" },
          { title: "prepareSubmission", slug: "integrate/reference/prepare-submission", status: "planned" },
        ],
      },
    ],
  },
  {
    title: "Examples",
    items: [{ title: "Follow-up question", slug: "examples/follow-up-question", status: "live" }],
  },
  { title: "Compliance and security", items: [] },
];
