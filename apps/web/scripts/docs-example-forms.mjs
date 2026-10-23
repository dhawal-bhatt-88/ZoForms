// The docs' live examples render real downloads. This builds each example form
// through the builder's API (a throwaway account, as the e2e suites do), saves
// it, writes the artifact the editor's Download button gives next to the page
// that uses it, and then deletes the account and its forms.
//
//   API on :4000 (or E2E_API_URL), then: node apps/web/scripts/docs-example-forms.mjs
//
// Only the author's input is written here: labels, options, required and
// conditions. Option codes, condition ids, identity and the file's shape come
// from the builder.
//
// The API has no way for an account to delete itself, so the clean-up uses the
// database directly, with the API's own .env and Prisma client, exactly as the
// e2e suites' clean-up does.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "../../..");
const API = process.env.E2E_API_URL || "http://localhost:4000";
const CONTENT = path.join(HERE, "../content/docs");

const apiRequire = createRequire(path.join(ROOT, "apps/api/package.json"));
apiRequire("dotenv").config({ path: path.join(ROOT, "apps/api/.env") });
const { PrismaClient } = apiRequire("@prisma/client");

/** Options with empty codes: the builder generates each from its label at save (contract §13.3). */
const options = (...labels) => labels.map((label) => ({ code: "", label }));

const FORMS = [
  {
    file: "build/question-types/dropdown.form.json",
    title: "Dropdown example",
    blocks: [
      {
        id: "referral_source",
        type: "dropdown",
        label: "How was the client referred?",
        description: "Choose the closest match.",
        required: true,
        options: options(
          "Self",
          "Family member",
          "Primary care provider",
          "Psychiatrist",
          "Therapist or counselor",
          "School",
          "Employer or EAP",
          "Court or probation",
          "Hospital emergency department",
          "Inpatient unit",
          "Insurance company",
          "Community agency",
          "Other",
        ),
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

const email = `docs-examples-${Date.now()}@example.test`;
const prisma = new PrismaClient();
try {
  const { token } = JSON.parse(
    await call("POST", "/v1/auth/signup", null, { email, password: "Docs-examples-123!", name: "Docs examples" }),
  );
  for (const form of FORMS) {
    const { id } = JSON.parse(await call("POST", "/v1/forms", token, { title: form.title }));
    await call("PUT", `/v1/forms/${id}/schema`, token, { title: form.title, blocks: form.blocks });
    const artifact = await call("GET", `/v1/forms/${id}/artifact`, token);
    fs.writeFileSync(path.join(CONTENT, form.file), artifact);
    console.log(`wrote content/docs/${form.file}`);
  }
} finally {
  // The account's organization (and with it the forms), then the account.
  const user = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
  if (user) {
    for (const m of user.memberships) await prisma.organization.delete({ where: { id: m.orgId } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`deleted the throwaway account ${email} and its forms`);
  }
  await prisma.$disconnect();
}
