// The docs' live examples render real downloads. This builds each example form
// through the builder's API (a throwaway account, as the e2e suites do), saves
// it, and writes the artifact the editor's Download button gives next to the
// page that uses it.
//
//   API on :4000 (or E2E_API_URL), then: node apps/web/scripts/docs-example-forms.mjs
//
// Only the author's input is written here: labels, options, required and
// conditions. Option codes, condition ids, identity and the file's shape come
// from the builder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.E2E_API_URL || "http://localhost:4000";
const CONTENT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../content/docs");

/** Options as the builder's editor saves them; codes are left for the API to check. */
const options = (...labels) =>
  labels.map((label) => ({ code: label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9._-]/g, ""), label }));

const FORMS = [
  {
    file: "build/question-types/dropdown.form.json",
    title: "Dropdown example",
    blocks: [
      {
        id: "relationship",
        type: "dropdown",
        label: "Your relationship to the client",
        description: "Choose the closest match.",
        required: true,
        options: options("Parent", "Guardian", "Spouse or partner", "Sibling", "Other relative", "Caseworker", "Other"),
      },
    ],
  },
  {
    file: "examples/follow-up-question.form.json",
    title: "Follow-up question",
    blocks: [
      {
        id: "sees_therapist",
        type: "choice",
        label: "Does the client currently see a therapist?",
        required: true,
        options: options("Yes", "No"),
      },
      {
        id: "therapist_name",
        type: "short",
        label: "Therapist's name",
        required: true,
        enableWhen: [{ question: "sees_therapist", operator: "=", answer: "yes" }],
      },
    ],
  },
];

async function call(method, url, token, body) {
  const res = await fetch(API + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${text}`);
  return text;
}

const { token } = JSON.parse(
  await call("POST", "/v1/auth/signup", null, {
    email: `docs-examples-${Date.now()}@example.test`,
    password: "Docs-examples-123!",
    name: "Docs examples",
  }),
);
for (const form of FORMS) {
  const { id } = JSON.parse(await call("POST", "/v1/forms", token, { title: form.title }));
  await call("PUT", `/v1/forms/${id}/schema`, token, { title: form.title, blocks: form.blocks });
  const artifact = await call("GET", `/v1/forms/${id}/artifact`, token);
  fs.writeFileSync(path.join(CONTENT, form.file), artifact);
  console.log(`wrote content/docs/${form.file}`);
}
