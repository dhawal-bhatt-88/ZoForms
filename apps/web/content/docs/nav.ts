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
      { title: "How Zowork Forms fits your app", slug: "integrate/overview", status: "live" },
      { title: "Quickstart", slug: "integrate/quickstart", status: "live" },
      {
        title: "Build an intake page in Next.js",
        slug: "integrate/tutorial-nextjs",
        status: "planned",
        notes: "Developer docs brief, CP5: App Router, 'use client', a route handler with prepareSubmission, deduping on idempotencyKey, onRenderError, a signed-in scope.",
      },
      {
        title: "How-to guides",
        pages: [
          { title: "Validate and store submissions", slug: "integrate/validate-and-store", status: "live" },
          { title: "Add your own validation", slug: "integrate/custom-validation", status: "live" },
          { title: "Send the submission with your app's sign-in", slug: "integrate/sign-in", status: "live" },
          { title: "Handle errors", slug: "integrate/handle-errors", status: "live" },
          { title: "Use it with your framework", slug: "integrate/frameworks", status: "live" },
          { title: "Content Security Policy", slug: "integrate/content-security-policy", status: "live" },
          { title: "Serve images, video and audio", slug: "integrate/media", status: "live" },
          { title: "Update to a new form version", slug: "integrate/form-versions", status: "live" },
          { title: "Read scores", slug: "integrate/scores", status: "live" },
          { title: "Save progress (drafts)", slug: "integrate/drafts", status: "live" },
          { title: "Shared devices and kiosks", slug: "integrate/shared-devices", status: "live" },
          { title: "Style the form", slug: "integrate/styling", status: "live" },
        ],
      },
      {
        title: "Reference",
        pages: [
          { title: "FormRenderer", slug: "integrate/reference/form-renderer", status: "live" },
          { title: "prepareSubmission", slug: "integrate/reference/prepare-submission", status: "live" },
          { title: "clearDrafts", slug: "integrate/reference/clear-drafts", status: "live" },
          { title: "The posted body", slug: "integrate/reference/posted-body", status: "live" },
          { title: "The form file", slug: "integrate/reference/form-file", status: "live" },
          { title: "CSS classes and custom properties", slug: "integrate/reference/css", status: "live" },
          { title: "Other /core exports", slug: "integrate/reference/core", status: "live" },
        ],
      },
      {
        title: "Concepts",
        pages: [
          { title: "Answers and their states", slug: "integrate/concepts/answers", status: "live" },
          { title: "What is stored in the browser", slug: "integrate/concepts/browser-storage", status: "live" },
        ],
      },
    ],
  },
  {
    title: "Examples",
    items: [{ title: "Follow-up question", slug: "examples/follow-up-question", status: "live" }],
  },
  {
    title: "Compliance and security",
    items: [
      { title: "Where respondents' data goes", slug: "compliance/data-flow", status: "live" },
    ],
  },
];
