// The docs' live examples render real downloads. This builds each example form
// through the builder's API (a throwaway account, as the e2e suites do), saves
// it, writes the artifact the editor's Download button gives next to the page
// that uses it, and then deletes the account and its forms.
//
//   API on :4000 (or E2E_API_URL), then: node apps/web/scripts/docs-example-forms.mjs
//   or, for some of them: node apps/web/scripts/docs-example-forms.mjs build/question-types/date.form.json …
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
  // The file the developer pages' code runs against (docs/briefs/BUILDER-BRIEF-DEVELOPER-DOCS.md).
  {
    file: "integrate/intake-form.form.json",
    title: "Client intake",
    description: "We use this to prepare for the first visit.",
    blocks: [
      { id: "preferred_name", type: "short", label: "Preferred name", required: true },
      { id: "contact_email", type: "email", label: "Email address", required: true },
      {
        id: "attend_format",
        type: "choice",
        label: "How would you like to attend sessions?",
        required: true,
        options: options("In person", "Video", "Phone"),
      },
      {
        id: "sees_therapist",
        type: "choice",
        label: "Do you currently see a therapist?",
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
      { id: "reason_for_visit", type: "long", label: "What brings you in today?" },
    ],
  },
  // The simple inputs (docs/briefs/BUILDER-BRIEF-DOCS-QUESTIONS.md, CP1): one question each.
  ...[
    ["short-answer", "Short answer example", { id: "preferred_name", type: "short", label: "Preferred name", description: "The name you'd like staff to use." }],
    ["long-answer", "Long answer example", { id: "reason_for_visit", type: "long", label: "What brings you in today?", description: "In your own words. Share as much or as little as you like." }],
    ["number", "Number example", { id: "therapy_visits", type: "number", label: "How many times have you seen a therapist or counselor in the past 12 months?", description: "Enter 0 if none." }],
    ["email", "Email example", { id: "email", type: "email", label: "Email address", description: "We'll send appointment reminders here." }],
    ["phone-number", "Phone number example", { id: "phone", type: "phone", label: "Best phone number to reach you" }],
    ["link", "Link example", { id: "referring_website", type: "link", label: "Referring practice's website", description: "Include https://." }],
    ["date", "Date example", { id: "date_of_birth", type: "date", label: "Date of birth" }],
    ["time", "Time example", { id: "preferred_time", type: "time", label: "Preferred appointment time", description: "We'll try to book the nearest available slot." }],
  ].map(([name, title, block]) => ({
    file: `build/question-types/${name}.form.json`,
    title,
    blocks: [{ ...block, required: true }],
  })),
  // The choice types (CP2). Multiple choice also has an optional question, which
  // shows Clear selection once answered (renderer 0.27.0 brief, CP2).
  {
    file: "build/question-types/multiple-choice.form.json",
    title: "Multiple choice example",
    blocks: [
      { id: "attend_format", type: "choice", label: "How would you like to attend sessions?", required: true, options: options("In person", "Video", "Phone") },
      { id: "time_of_day", type: "choice", label: "Which time of day suits you best?", required: false, options: options("Morning", "Afternoon", "Evening") },
    ],
  },
  ...[
    ["checkboxes", "Checkboxes example", { id: "available_days", type: "checkbox", label: "Which days can you usually attend?", options: options("Monday", "Tuesday", "Wednesday", "Thursday", "Friday") }],
    ["respondents-country", "Respondent's country example", { id: "country", type: "country", label: "Country of residence" }],
  ].map(([name, title, block]) => ({
    file: `build/question-types/${name}.form.json`,
    title,
    blocks: [{ ...block, required: true }],
  })),
  // The scales and ranking (CP3). Ranking has Rank every option on, which makes it required.
  ...[
    ["linear-scale", "Linear scale example", { id: "booking_ease", type: "scale", label: "How easy was it to book this appointment?", description: "1 = very hard, 5 = very easy", min: 1, max: 5 }],
    ["rating", "Rating example", { id: "checkin_rating", type: "rating", label: "How would you rate your check-in experience today?" }],
    ["ranking", "Ranking example", {
      id: "therapist_priorities", type: "ranking", label: "Rank what matters most when choosing a therapist", required: false, completeRequired: true,
      options: options("Appointment availability", "Distance from home", "Cost", "Therapist's specialty"),
    }],
  ].map(([name, title, block]) => ({
    file: `build/question-types/${name}.form.json`,
    title,
    blocks: [{ required: true, ...block }],
  })),
  // The tables (CP4). A matrix with Answer every row on; a grid, whose columns are required one by one.
  {
    file: "build/question-types/matrix.form.json",
    title: "Matrix example",
    blocks: [
      {
        id: "visit_satisfaction",
        type: "matrix",
        label: "How satisfied were you with each part of your visit?",
        required: false,
        completeRequired: true,
        options: options("Booking", "Check-in", "Waiting time", "Session"),
        columns: options("Very dissatisfied", "Dissatisfied", "Satisfied", "Very satisfied"),
      },
    ],
  },
  {
    file: "build/question-types/grid.form.json",
    title: "Grid example",
    blocks: [
      {
        id: "weekly_availability",
        type: "grid",
        label: "Weekly availability",
        rows: options("Monday", "Tuesday", "Wednesday", "Thursday", "Friday"),
        columns: [
          { code: "", label: "Available", type: "radio", options: options("Yes", "No"), required: true },
          { code: "", label: "Session format", type: "dropdown", options: options("In person", "Video", "Phone") },
          { code: "", label: "Earliest time", type: "text" },
        ],
      },
    ],
  },
  // Layout and media (CP5). Display blocks have no Required and no help text; each label is the one
  // the builder gives a new block, except where the label is what respondents see or hear.
  {
    file: "build/layout-and-media/layout-blocks.form.json",
    title: "Layout blocks example",
    blocks: [
      { id: "about_heading", type: "heading", label: "About your visit", level: 2 },
      { id: "intro_text", type: "text", label: "Text", content: "This form takes about 5 minutes. Only the intake team sees your answers." },
      { id: "divider", type: "divider", label: "Divider" },
      { id: "contact_title", type: "title", label: "Title", content: "Contact details" },
      { id: "required_note", type: "label", label: "Label", content: "Questions marked * are required." },
    ],
  },
  {
    file: "build/layout-and-media/image.form.json",
    title: "Image example",
    blocks: [
      {
        id: "entrance_map",
        type: "image",
        label: "Map of the clinic: the entrance faces Main Street, the parking lot is beside the clinic, and reception is just inside the entrance.",
        content: "/docs/clinic-entrance-map.svg",
      },
    ],
  },
  // Video and audio: shown as schema only, with no player, until the docs have their own files.
  {
    file: "build/layout-and-media/video.form.json",
    title: "Video example",
    blocks: [{ id: "welcome_video", type: "video", label: "Welcome from the intake team", content: "/videos/welcome.mp4" }],
  },
  {
    file: "build/layout-and-media/audio.form.json",
    title: "Audio example",
    blocks: [
      { id: "directions_audio", type: "audio", label: "Directions to the clinic", content: "/audio/directions.mp3" },
      {
        id: "directions_transcript",
        type: "text",
        label: "Text",
        content: "Transcript: The clinic is on Main Street, next to the parking lot. Come in through the front entrance; reception is just inside.",
      },
    ],
  },
  // Structure (CP6): a group, a repeating group, and a form with pages, progress bar and review page.
  {
    file: "build/structure/groups.form.json",
    title: "Group example",
    blocks: [
      {
        id: "emergency_contact",
        type: "group",
        label: "Emergency contact",
        blocks: [
          { id: "contact_name", type: "short", label: "Name", required: true },
          { id: "contact_relationship", type: "short", label: "Relationship" },
          { id: "contact_phone", type: "phone", label: "Phone number", required: true },
        ],
      },
    ],
  },
  {
    file: "build/structure/repeating-groups.form.json",
    title: "Repeating group example",
    blocks: [
      {
        id: "medications",
        type: "group",
        label: "Current medications",
        repeats: true,
        repeatLabel: "medication",
        minOccurs: 0,
        maxOccurs: 10,
        blocks: [
          { id: "medication_name", type: "short", label: "Medication name", required: true },
          { id: "medication_dose", type: "short", label: "Dose" },
        ],
      },
    ],
  },
  {
    file: "build/structure/pages.form.json",
    title: "Pages example",
    navigation: { progressStyle: "bar", reviewPage: true },
    blocks: [
      {
        id: "page_about",
        type: "page",
        title: "About you",
        blocks: [
          { id: "preferred_name", type: "short", label: "Preferred name", required: true },
          { id: "age", type: "number", label: "Age", required: true },
          {
            id: "guardian_name",
            type: "short",
            label: "Parent or guardian's name",
            required: true,
            enableWhen: [{ question: "age", operator: "<", answer: 18 }],
          },
        ],
      },
      {
        id: "page_contact",
        type: "page",
        title: "Contact",
        blocks: [
          { id: "email", type: "email", label: "Email address", required: true },
          { id: "phone", type: "phone", label: "Best phone number to reach you" },
        ],
      },
      {
        id: "page_visit",
        type: "page",
        title: "Your visit",
        blocks: [{ id: "reason_for_visit", type: "long", label: "What brings you in today?", required: true }],
      },
    ],
  },
];

// Only the files named on the command line, if any, so building a new example
// leaves the others' files (and their form ids) as they are.
const wanted = process.argv.slice(2);
const unknown = wanted.filter((f) => !FORMS.some((form) => form.file === f));
if (unknown.length) throw new Error(`no example form for: ${unknown.join(", ")}`);
const building = wanted.length ? FORMS.filter((form) => wanted.includes(form.file)) : FORMS;

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
  for (const form of building) {
    const { id } = JSON.parse(await call("POST", "/v1/forms", token, { title: form.title }));
    await call("PUT", `/v1/forms/${id}/schema`, token, {
      title: form.title,
      ...(form.description ? { description: form.description } : {}),
      blocks: form.blocks,
      ...(form.navigation ? { navigation: form.navigation } : {}),
    });
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
