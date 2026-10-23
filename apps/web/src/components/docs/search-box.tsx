"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@formbuilder/ui";
import { docsHref } from "@/lib/docs/nav";
import { search, type SearchEntry } from "@/lib/docs/search";

/**
 * Search the docs. The index (/docs/search-index.json, built with the site)
 * is fetched the first time the box gets focus, and matched in the browser.
 *
 * Results are a list of links under the box: Down arrow moves into them, the
 * arrows move between them, Escape goes back to the box and closes them. The
 * count is announced in a polite status line.
 */
export function SearchBox({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const loading = useRef(false);
  const closing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  function load() {
    if (index || loading.current) return;
    loading.current = true;
    fetch("/docs/search-index.json")
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => {
        loading.current = false;
      });
  }

  const results = index ? search(index, query) : [];
  const showing = open && query.trim().length > 0;
  const links = () => [...(list.current?.querySelectorAll("a") ?? [])];

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      // Back to the box without its focus handler opening the results again.
      closing.current = true;
      input.current?.focus();
      closing.current = false;
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const all = links();
    if (!all.length) return;
    e.preventDefault();
    const at = all.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") all[Math.min(at + 1, all.length - 1)].focus();
    else if (at <= 0) input.current?.focus();
    else all[at - 1].focus();
  }

  return (
    <div
      role="search"
      className={cn("relative", className)}
      onKeyDown={onKey}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={`${id}-q`} className="sr-only">
        Search the docs
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-graphite-soft" />
      <input
        ref={input}
        id={`${id}-q`}
        type="search"
        value={query}
        placeholder="Search the docs"
        autoComplete="off"
        aria-describedby={`${id}-status`}
        onFocus={() => {
          load();
          if (!closing.current) setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className="w-full rounded-lg border border-rule-strong bg-surface py-1.5 pl-8 pr-2.5 text-[0.8125rem] text-ink placeholder:text-graphite-soft sm:w-64"
      />
      <p id={`${id}-status`} role="status" className="sr-only">
        {showing ? (index ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Loading") : ""}
      </p>
      {showing && (
        <div className="surface absolute left-0 right-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto p-1.5 shadow-lg sm:left-auto sm:w-80">
          {!index ? (
            <p className="px-2.5 py-2 text-[0.8125rem] text-graphite">Loading…</p>
          ) : results.length === 0 ? (
            <p className="px-2.5 py-2 text-[0.8125rem] text-graphite">No pages match &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            <ul ref={list} aria-label="Search results">
              {results.map(({ entry }) => (
                <li key={entry.slug}>
                  <Link
                    href={docsHref(entry.slug)}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2.5 py-2 hover:bg-paper-sunk focus-visible:bg-paper-sunk"
                  >
                    <span className="block text-[0.8125rem] font-medium text-ink">{entry.title}</span>
                    <span className="block text-[0.75rem] text-graphite">
                      {entry.section} · {entry.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
