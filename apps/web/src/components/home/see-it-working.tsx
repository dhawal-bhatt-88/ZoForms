"use client";

import dynamic from "next/dynamic";
import type { FormSchema } from "@zoworkhq/zoforms/core";

/*
 * The home page's live examples: the docs' LiveExample, so the real
 * @zoworkhq/zoforms renders real builder downloads (content/home/*.form.json and
 * the docs' follow-up example), with two tabs: the form, and Server output,
 * which prepareSubmission works out from the body the form posted. Nothing
 * there is written by hand.
 *
 * Loaded only after the page paints, so the renderer's code isn't in the home
 * page's first load, and never for a signed-in visitor, who is sent on to the
 * app before then. Submitting goes to LiveExample's stand-in endpoint: nothing
 * leaves the browser.
 */
const LiveExample = dynamic(() => import("@/components/docs/live-example").then((m) => m.LiveExample), {
  ssr: false,
  loading: () => <p className="surface body-sm my-6 p-6 text-graphite">Loading the example…</p>,
});

export type HomeExample = {
  /** The form file's name, e.g. "check-in". */
  name: string;
  title: string;
  body: string;
  schema: FormSchema;
};

export function SeeItWorking({ css, examples }: { css: string; examples: HomeExample[] }) {
  return (
    <ul className="mt-10 space-y-12">
      {examples.map((example) => (
        <li key={example.name} className="grid gap-x-10 gap-y-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="lg:pt-6">
            <h3 className="font-semibold">{example.title}</h3>
            <p className="body-sm mt-1.5 text-graphite">{example.body}</p>
          </div>
          <LiveExample
            name={example.name}
            title={example.title}
            schema={example.schema}
            css={css}
            tabs={["preview", "server"]}
            density={false}
          />
        </li>
      ))}
    </ul>
  );
}
