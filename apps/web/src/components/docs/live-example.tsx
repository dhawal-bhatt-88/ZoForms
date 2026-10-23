"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw } from "lucide-react";
import { FormRenderer } from "@zoworkhq/forms/react";
import { prepareSubmission, type FormSchema } from "@zoworkhq/forms/core";
import { Button, segmentClasses, segmentTrackClasses } from "@/components/ui";
import { EXAMPLE_ENDPOINT_PREFIX, registerExampleEndpoint } from "@/lib/docs/example-fetch";
import type { ExampleTab } from "@/lib/docs/templates";
import { CodeBlock } from "./code-block";
import { Tabs, type TabSpec } from "./tabs";

/**
 * A live example: the real @zoworkhq/forms rendering a real form file, with
 * tabs that show what it is and what it does. Nothing on the tabs is written
 * by hand:
 *   - Schema is the form file itself.
 *   - Payload is the body FormRenderer posted on the last submit.
 *   - Server output is prepareSubmission run on that body, here in the
 *     browser: the function a host runs on its server.
 *
 * The form renders in an open shadow root with the package's own stylesheet
 * inside it. The renderer's rules have no specificity (each is in `:where()`),
 * so the builder's Tailwind base (`button { background-color: transparent }`
 * and the like) would otherwise win over them. Inherited text styles and the
 * `--zf-*` properties still reach in, as they would in a host's page.
 *
 * Submitting goes to a stand-in endpoint (lib/docs/example-fetch.ts) that
 * exists only while this is mounted. Nothing leaves the page.
 */
export function LiveExample({
  name,
  title,
  schema,
  css,
  tabs,
  density: offerDensity,
  reactCode,
}: {
  /** The form file's name, e.g. "follow-up-question". */
  name: string;
  /** For the tab list's name: "Example: Follow-up question". */
  title: string;
  schema: FormSchema;
  /** @zoworkhq/forms/styles.css. */
  css: string;
  tabs: readonly ExampleTab[];
  density: boolean;
  reactCode?: string;
}) {
  const endpoint = `${EXAMPLE_ENDPOINT_PREFIX}${name}/${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [run, setRun] = useState(0);
  const [payload, setPayload] = useState<unknown>(null);
  const [server, setServer] = useState<unknown>(null);
  const [density, setDensity] = useState<Density>("standard");
  const dark = useDarkTheme();
  const mount = useShadowMount(css);

  useEffect(
    () =>
      registerExampleEndpoint(endpoint, (body) => {
        const sent = JSON.parse(body);
        let result: unknown;
        let status: number;
        try {
          const prepared = prepareSubmission(schema, sent);
          result = prepared;
          status = prepared.ok ? 200 : 422;
        } catch (error) {
          // A malformed schema throws: a fault in the form file, shown as it is.
          result = { threw: String(error) };
          status = 500;
        }
        setPayload(sent);
        setServer(result);
        return new Response(JSON.stringify(status === 200 ? { ok: true } : result), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }),
    [endpoint, schema],
  );

  const json = JSON.stringify(schema, null, 2);
  const file = `${name}.json`;
  const notYet = <p className="body-sm text-graphite">Submit the form on the Preview tab to see this.</p>;

  const all: Record<ExampleTab, TabSpec> = {
    preview: {
      id: "preview",
      label: "Preview",
      content: (
        <div className="surface p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {offerDensity ? <DensityChoice value={density} onChange={setDensity} /> : <span />}
            {payload !== null && (
              <Button
                size="sm"
                onClick={() => {
                  setRun((n) => n + 1);
                  setPayload(null);
                  setServer(null);
                }}
              >
                <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                Start again
              </Button>
            )}
          </div>
          <div data-docs-example={name} ref={mount.host} />
          {mount.node &&
            createPortal(
              <div data-zf-theme={dark ? "dark" : undefined} data-zf-density={offerDensity ? density : undefined}>
                <FormRenderer key={run} schema={schema} endpoint={endpoint} />
              </div>,
              mount.node,
            )}
        </div>
      ),
    },
    schema: {
      id: "schema",
      label: "Schema",
      content: (
        <CodeBlock
          code={json}
          lang="json"
          title={file}
          actions={
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(json + "\n")}`}
              download={file}
              className="link text-[0.75rem]"
            >
              Download
            </a>
          }
        />
      ),
    },
    react: {
      id: "react",
      label: "React code",
      content: (
        <>
          <CodeBlock code={reactCode ?? ""} lang="jsx" />
          <p className="body-sm text-graphite">
            This page also renders the form in a shadow root, to keep the docs&rsquo; own styles off it, and posts to a
            stand-in endpoint. Your app needs neither.
          </p>
        </>
      ),
    },
    payload: {
      id: "payload",
      label: "Payload",
      content:
        payload === null ? (
          notYet
        ) : (
          <>
            <p className="body-sm text-graphite">
              What <code className="font-mono">FormRenderer</code> posted to its endpoint on the last submit.
            </p>
            <CodeBlock code={JSON.stringify(payload, null, 2)} lang="json" title="Request body" />
          </>
        ),
    },
    server: {
      id: "server",
      label: "Server output",
      content:
        server === null ? (
          notYet
        ) : (
          <>
            <p className="body-sm text-graphite">
              Computed in your browser by <code className="font-mono">prepareSubmission</code> from{" "}
              <code className="font-mono">@zoworkhq/forms/core</code>, the same function your server runs on that body.
            </p>
            <CodeBlock code={JSON.stringify(server, null, 2)} lang="json" title="prepareSubmission(schema, body)" />
          </>
        ),
    },
  };

  return (
    <div className="my-6">
      <Tabs label={`Example: ${title}`} tabs={tabs.map((t) => all[t])} />
    </div>
  );
}

/**
 * An open shadow root on `host`, holding the renderer's stylesheet and the
 * node the form is portalled into. React listens for events on a portal's
 * container, so events inside the shadow tree reach the form's handlers.
 */
function useShadowMount(css: string) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Development runs effects twice; a host only ever gets one shadow root.
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = css;
    const container = document.createElement("div");
    root.replaceChildren(style, container);
    setNode(container);
    return () => {
      setNode(null);
      root.replaceChildren();
    };
  }, [css]);

  return { host: hostRef, node };
}

/** The renderer's dark theme is opt-in only (`data-zf-theme="dark"`), so follow the docs' own. */
function useDarkTheme(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

type Density = "patient" | "standard" | "dense";
const DENSITIES: readonly { value: Density; label: string }[] = [
  { value: "patient", label: "Patient" },
  { value: "standard", label: "Standard" },
  { value: "dense", label: "Dense" },
];

/** `data-zf-density`, as a radio group: one tab stop, the arrow keys move the choice. */
function DensityChoice({ value, onChange }: { value: Density; onChange: (d: Density) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + DENSITIES.length) % DENSITIES.length;
    onChange(DENSITIES[next].value);
    buttons.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label="Density" className={segmentTrackClasses()}>
      {DENSITIES.map((d, i) => (
        <button
          key={d.value}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === d.value}
          tabIndex={value === d.value ? 0 : -1}
          onClick={() => onChange(d.value)}
          onKeyDown={(e) => onKey(e, i)}
          className={segmentClasses({ selected: value === d.value, size: "sm" })}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
