// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormRenderer } from "@zoworkhq/zoforms/react";
import { assertSchemaIntegrity, prepareSubmission, type FormSchema } from "@zoworkhq/zoforms/core";
import { buildArtifact } from "@formbuilder/form-schema";

/*
 * Multi-select is no longer in the insert menu (renderer 0.28.1 brief, item 5),
 * but forms that have one must keep working for respondents. A download with a
 * scored Multi-select that drives a condition, rendered by the real
 * FormRenderer, answered, submitted, and stored by prepareSubmission.
 * e2e/verify-multiselect-legacy.js covers the editor.
 */

const IDS = { formId: "00000000-0000-4000-8000-0000000000a1", formVersionId: "00000000-0000-4000-8000-0000000000a2" };
const option = (code: string, label: string, score: number) => ({ code, label, score });

const form = buildArtifact(
  {
    title: "Languages",
    blocks: [
      {
        id: "g",
        type: "group",
        label: "About you",
        scores: [{ id: "total", label: "Languages score", formulaText: "langs", unanswered: "no-score" }],
        blocks: [
          {
            id: "langs",
            type: "multiselect",
            label: "Which languages do you speak?",
            name: "langs",
            required: true,
            options: [option("english", "English", 1), option("french", "French", 2), option("spanish", "Spanish", 4)],
          },
          {
            id: "where",
            type: "short",
            label: "Where did you learn French?",
            required: false,
            enableWhen: [{ question: "langs", operator: "contains", answer: "french" }],
          },
        ],
      },
    ],
  },
  IDS,
) as unknown as FormSchema;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a form that already has a Multi-select", () => {
  it("is a download the renderer accepts", () => {
    expect(() => assertSchemaIntegrity(form)).not.toThrow();
    expect(JSON.stringify(form)).toContain('"type":"multiselect"');
  });

  it("renders, answers, submits and is stored like Checkboxes", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    render(createElement(FormRenderer, { schema: form, endpoint: "/api/submit" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "French" })).toBeTruthy());

    // Its condition: the follow-up shows once French is ticked.
    expect(screen.queryByLabelText(/^Where did you learn French/)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Spanish" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "French" }));
    fireEvent.change(await screen.findByLabelText(/^Where did you learn French/), { target: { value: "At school" } });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await screen.findByText("Form submitted successfully.");

    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect(body.answers).toMatchObject({ langs: { state: "answered", value: ["spanish", "french"] } });
    expect(body.formVersionId).toBe(IDS.formVersionId);

    const result = prepareSubmission(form, body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.versionMismatch).toBe(false);
    expect(result.submission.answeredFormVersionId).toBe(IDS.formVersionId);
    expect(result.submission.answers.langs).toEqual({
      state: "answered",
      value: [
        { code: "spanish", label: "Spanish" },
        { code: "french", label: "French" },
      ],
    });
    expect(result.submission.answers.where).toEqual({ state: "answered", value: "At school" });
    expect(result.submission.scores).toMatchObject([{ label: "Languages score", value: 6 }]);
  });

  it("is required like Checkboxes: nothing ticked, nothing sent", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    render(createElement(FormRenderer, { schema: form, endpoint: "/api/submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await screen.findByText("There is a problem");
    expect(fetch).not.toHaveBeenCalled();
  });
});
