// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { FormSchema } from "@zoworkhq/zoforms/core";
import { LiveExample } from "./live-example";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const form = (blocks: unknown[]) =>
  ({ title: "T", formId: "f", formVersionId: "v", schemaVersion: 2, blocks }) as unknown as FormSchema;
const example = (schema: FormSchema) => (
  <LiveExample name="f" title="F" schema={schema} css="" tabs={["preview"]} density={false} />
);

describe("LiveExample", () => {
  it("says why when the renderer refuses the form file", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(example(form([{ id: "a", type: "nope", label: "A" }])));
    expect((await screen.findByRole("alert")).textContent).toBe(
      `This example’s form file can’t be shown: Block "a" has unknown type "nope".`,
    );
  });

  it("shows no such line for a form the renderer accepts", async () => {
    render(example(form([{ id: "a", type: "short", label: "A" }])));
    await new Promise((resolve) => setTimeout(resolve));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
