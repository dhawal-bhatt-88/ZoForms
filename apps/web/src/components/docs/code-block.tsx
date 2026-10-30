import { CopyButton } from "@/components/ui";

/**
 * Code on a docs page: a bar naming it, with Copy (and any other actions),
 * over the code. Long lines scroll inside the block rather than wrapping, so
 * indentation survives on a phone; the block is focusable and named, like the
 * home page's example, so the keyboard can scroll it too.
 *
 * No hooks of its own, so both the server-rendered pages and the live
 * example's client tabs use it.
 */
export function CodeBlock({
  code,
  lang,
  title,
  actions,
}: {
  code: string;
  lang?: string;
  /** Shown in the bar and used as the block's name; defaults to the language. */
  title?: string;
  /** Extra buttons or links beside Copy. */
  actions?: React.ReactNode;
}) {
  const name = title ?? (lang ? `${LANGS[lang] ?? lang} code` : "Code");
  const text = code.replace(/\n$/, "");
  return (
    <div className="surface my-5 flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-3 py-1.5">
        <p className="font-mono text-[0.6875rem] text-graphite">{title ?? (lang ? LANGS[lang] ?? lang : "Code")}</p>
        <div className="flex items-center gap-2">
          {actions}
          <CopyButton value={text} variant="ghost" />
        </div>
      </div>
      <pre
        tabIndex={0}
        role="region"
        aria-label={name}
        className="overflow-x-auto bg-paper-sunk px-4 py-3 font-mono text-[0.75rem] leading-relaxed text-ink"
      >
        <code>{text}</code>
      </pre>
    </div>
  );
}

const LANGS: Record<string, string> = { js: "JavaScript", jsx: "JSX", ts: "TypeScript", tsx: "TSX", json: "JSON", css: "CSS", html: "HTML", sh: "Shell", bash: "Shell", text: "Text" };

/**
 * MDX's ``` fences: `<pre><code className="language-x">`. The `code` child is
 * read for its text and language, never rendered as it is.
 */
export function MdxPre({ children }: { children?: React.ReactNode }) {
  const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode; "data-file"?: string }> | undefined;
  const lang = child?.props?.className?.match(/language-(\S+)/)?.[1];
  const code = typeof child?.props?.children === "string" ? child.props.children : "";
  return <CodeBlock code={code} lang={lang} title={child?.props?.["data-file"]} />;
}
