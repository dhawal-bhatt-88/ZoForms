import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareSubmission, type FieldValidator, type FormSchema } from "@zoworkhq/zoforms/core";
import { EXAMPLE_VALIDATORS } from "@/components/docs/example-validators";
import { examplesOf } from "./code-examples";
import { CONTENT_DIR, getPage } from "./content";

/*
 * "Your own validator" (developer docs brief, scope item 4): the code the page
 * shows is the module its live example runs, and each thing Try this says
 * happens does, through the real prepareSubmission on the example's form.
 */

const page = getPage("examples/own-validator")!;
const source = fs.readFileSync(path.join(CONTENT_DIR, "examples", "own-validator.validators.js"), "utf8").replace(/\r\n/g, "\n");
const schema = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "examples", "own-validator.form.json"), "utf8")) as FormSchema;
const validators = EXAMPLE_VALIDATORS["own-validator"] as FieldValidator[];

const submit = (answers: Record<string, string | undefined>) => {
  const body = {
    idempotencyKey: "demo-key-1",
    formVersionId: schema.formVersionId,
    submittedAt: "2026-11-03T09:15:00.000Z",
    answers: Object.fromEntries(Object.entries(answers).map(([id, value]) => [id, value === undefined ? { state: "empty" } : { state: "answered", value }])),
  };
  const result = prepareSubmission(schema, body, { validators });
  return result.ok ? "ok" : result.errors.map((e) => `${e.blockId}: ${e.message}`);
};

describe("the Your own validator example", () => {
  it("shows the live example's validators word for word", () => {
    const shown = examplesOf(page).find((e) => e.file === "validators.js")!;
    expect(`${shown.code}\n`).toBe(source);
  });

  it("refuses a client ID in the wrong format, with the page's message", () => {
    const message = "Enter the client ID as DEMO- and six digits, such as DEMO-123456.";
    expect(page.body).toContain(`Under Client ID: "${message}"`);
    expect(page.body).toContain(`"Client ID": ${message}`);
    expect(submit({ client_id: "12345", referral_date: "2026-01-05", first_session: "2026-01-12" })).toEqual([`client_id: ${message}`]);
    expect(submit({ client_id: " DEMO-123456 ", referral_date: "2026-01-05", first_session: "2026-01-12" })).toBe("ok");
  });

  it("refuses a first session before the referral", () => {
    const message = "The first session can't be before the referral date.";
    expect(page.body).toContain(message);
    expect(submit({ client_id: "DEMO-123456", referral_date: "2026-01-05", first_session: "2026-01-04" })).toEqual([`first_session: ${message}`]);
    expect(submit({ client_id: "DEMO-123456", referral_date: "2026-01-05", first_session: "2026-01-05" })).toBe("ok");
  });

  it("with no referral date, only the required message", () => {
    expect(page.body).toContain('Only "Referral date" is required shows');
    expect(submit({ client_id: "DEMO-123456", referral_date: undefined, first_session: "2026-01-04" })).toEqual(['referral_date: "Referral date" is required.']);
  });

  it("an empty client ID gets the form's own message, never the validator's", () => {
    expect(submit({ client_id: undefined, referral_date: "2026-01-05", first_session: "2026-01-12" })).toEqual(['client_id: "Client ID" is required.']);
  });
});
