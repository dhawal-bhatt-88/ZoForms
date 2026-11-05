import Image from "next/image";

/*
 * A form built in ZoForms, twice: part of its download, and the same form
 * as @zoworkhq/zoforms renders it. Both are real.
 *
 * - public/home/phq-2.json is the artifact the builder's API returned for the
 *   form (GET /v1/forms/:id/artifact). The excerpt below is that file's text,
 *   shortened where it says "…", with the group's opening brackets and the
 *   formula's arguments on fewer lines.
 * - The screenshots are that file rendered by the renderer at 0.27.0, then
 *   named @zoworkhq/forms (renamed @zoworkhq/zoforms in 0.29.0), in the
 *   external test app, light and dark, with the host page in the renderer's
 *   own surface and text colours. They show the group heading and the first
 *   question, the part the excerpt covers.
 *
 * Retake both together if the form or the renderer's look changes.
 */

const EXCERPT = `{
  "title": "PHQ-2",
  "blocks": [{
    "type": "group",
    "label": "Over the last 2 weeks, how often …",
    "scores": [{
      "label": "Total score",
      "formula": {
        "op": "+",
        "args": [{ "ref": "interest" }, { "ref": "mood" }]
      }
    }],
    "blocks": [{
      "id": "interest",
      "type": "choice",
      "label": "Little interest or pleasure in doing things",
      "required": true,
      "options": [
        {
          "code": "not_at_all",
          "label": "Not at all",
          "score": 0
        },
        …`;

const ALT =
  "The form as rendered: the heading “Over the last 2 weeks, how often have you been bothered by any of the following problems?”, then the required question “Little interest or pleasure in doing things” with four choices: Not at all, Several days, More than half the days, Nearly every day.";

export function HeroVisual() {
  return (
    <figure>
      {/* Side by side only from 1024px: narrower, the JSON lines don't fit. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* `min-w-0`: a grid item would otherwise widen to the longest code line. */}
        <div className="surface flex min-w-0 flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-3">
            <p className="font-mono text-[0.75rem] text-ink">phq-2.json</p>
            <a href="/home/phq-2.json" download className="link text-[0.75rem]">
              Download the whole file
            </a>
          </div>
          {/* Wrapped JSON loses its indentation, so on a phone the code scrolls
              in its own box instead: focusable and named, for the keyboard. */}
          <pre
            tabIndex={0}
            role="region"
            aria-label="Excerpt of phq-2.json"
            className="flex-1 overflow-x-auto bg-paper-sunk px-4 py-3 font-mono text-[0.75rem] leading-relaxed text-ink"
          >
            <code>{EXCERPT}</code>
          </pre>
        </div>
        <div className="surface flex flex-col">
          <div className="border-b border-rule px-4 py-3">
            <p className="text-[0.75rem] text-ink">
              Rendered by <span className="font-mono">@zoworkhq/zoforms</span>
            </p>
          </div>
          <div className="flex flex-1 items-start justify-center p-4">
            <Image src="/home/phq-2-rendered-light.png" alt={ALT} width={508} height={430} className="h-auto w-full max-w-[508px] dark:hidden" />
            <Image src="/home/phq-2-rendered-dark.png" alt={ALT} width={508} height={430} className="hidden h-auto w-full max-w-[508px] dark:block" />
          </div>
        </div>
      </div>
      <figcaption className="body-sm mt-3 text-graphite">
        A two-question form built in ZoForms: part of the file it downloads as, and the same file rendered in an app.
        PHQ-2 questions developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an
        educational grant from Pfizer Inc.
      </figcaption>
    </figure>
  );
}
