// Seed a polished demo tenant (forms + realistic responses + analytics events)
// so every dashboard, chart, search, and AI panel is populated for a demo.
//
//   SEED_API=http://<host>:4000 node deploy/seed-demo.mjs
//
// Idempotent-ish: re-running logs into the same demo account and adds more data.
// Login after seeding:  demo@frame.so / FrameDemo2026!

const API = process.env.SEED_API || "http://localhost:4000";
const EMAIL = process.env.SEED_EMAIL || "demo@frame.so";
const PASSWORD = process.env.SEED_PASSWORD || "FrameDemo2026!";
let TOKEN = "";

const H = () => ({ "Content-Type": "application/json", ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) });
const post = async (p, b, auth = true) => {
  const r = await fetch(API + p, { method: "POST", headers: auth ? H() : { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  if (!r.ok) throw new Error(`${p} → ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r.json();
};
const put = async (p, b) => { const r = await fetch(API + p, { method: "PUT", headers: H(), body: JSON.stringify(b) }); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); };
const patch = async (p, b) => { const r = await fetch(API + p, { method: "PATCH", headers: H(), body: JSON.stringify(b) }); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const NAMES = ["Ava Chen", "Liam Patel", "Sofia Rossi", "Noah Kim", "Maya Okafor", "Ethan Brooks", "Isabella Nguyen", "Lucas Meyer", "Amara Diallo", "Owen Walsh", "Priya Shah", "Diego Alvarez", "Hana Sato", "Jonas Weber", "Leila Haddad", "Marco Bianchi", "Zoe Clarke", "Ravi Menon", "Elena Petrova", "Tom Fischer", "Grace Lin", "Omar Farouk", "Nina Larsen", "Kai Tanaka"];
const emailFor = (n) => n.toLowerCase().replace(/[^a-z]/g, ".") + "@" + pick(["acme.co", "northwind.io", "brightlabs.com", "glide.app", "makeflow.co"]);
const POS = ["Love the product, it's part of my daily workflow now.", "Super intuitive — onboarding was a breeze.", "The AI form generation saved me an hour.", "Fast, clean, reliable. No complaints.", "Best form builder I've used, hands down."];
const MID = ["Solid overall, would like more templates.", "Good, but mobile could be smoother.", "Works well; wish exports were faster.", "Decent — a few more integrations would help."];
const NEG = ["Hit a bug in the editor once.", "Pricing feels a touch high for small teams.", "Needed a feature that's not there yet."];

async function signupOrLogin() {
  try { const r = await post("/v1/auth/signup", { email: EMAIL, password: PASSWORD, name: "Demo Owner" }, false); TOKEN = r.token; console.log(`  signed up ${EMAIL}`); }
  catch { const r = await post("/v1/auth/login", { email: EMAIL, password: PASSWORD }, false); TOKEN = r.token; console.log(`  logged in existing ${EMAIL}`); }
}
async function makeForm(title, schema, publish = true) {
  const f = await post("/v1/forms", { title });
  await put(`/v1/forms/${f.id}/schema`, { ...schema, title });
  if (publish) await patch(`/v1/forms/${f.id}`, { status: "PUBLISHED" });
  return f;
}
async function events(slug, views, starts) {
  for (let i = 0; i < views; i++) await post(`/v1/public/forms/${slug}/events`, { type: "view", source: pick(["https://twitter.com", "https://google.com", "direct", "https://linkedin.com"]) }, false).catch(() => {});
  for (let i = 0; i < starts; i++) await post(`/v1/public/forms/${slug}/events`, { type: "start" }, false).catch(() => {});
}
async function submit(slug, data) { await post(`/v1/public/forms/${slug}/responses`, { data }, false).catch((e) => console.log("   submit skip:", e.message.slice(0, 50))); }

(async () => {
  console.log("Seeding", API);
  await signupOrLogin();

  // Put the demo org on Pro so there's no form quota and the Billing page
  // shows a paid plan. (No-op cost: dev-mode when Stripe isn't configured.)
  await post("/v1/billing/checkout", { plan: "pro" }).then(() => console.log("  upgraded demo org → Pro")).catch(() => {});

  const nps = await makeForm("Customer Feedback & NPS", { description: "Two quick questions — thank you!", settings: { theme: { accent: "#6D5EFA", radius: "md" }, notifyEmails: [EMAIL] }, blocks: [
    { id: "nps", type: "scale", label: "How likely are you to recommend us?", required: true, min: 0, max: 10 },
    { id: "why", type: "long", label: "What could we improve?", required: false },
    { id: "role", type: "choice", label: "Your role", required: false, options: ["Founder", "Product", "Engineering", "Design", "Marketing"] }] });
  await events(nps.slug, 320, 190);
  for (let i = 0; i < 24; i++) { const s = pick([9, 10, 10, 8, 9, 7, 10, 6, 9, 8, 10, 3, 9, 7, 10]); await submit(nps.slug, { nps: s, why: s >= 9 ? pick(POS) : s >= 7 ? pick(MID) : pick(NEG), role: pick(["Founder", "Product", "Engineering", "Design", "Marketing"]) }); }
  console.log("  ✓ NPS form + 24 responses");

  const job = await makeForm("Apply — Product Designer", { description: "We review every application.", settings: { theme: { accent: "#159C56", radius: "md" } }, blocks: [
    { id: "name", type: "short", label: "Full name", required: true },
    { id: "email", type: "email", label: "Email", required: true },
    { id: "years", type: "number", label: "Years of experience", required: true },
    { id: "why", type: "long", label: "Why do you want this role?", required: true }] });
  await events(job.slug, 140, 60);
  for (let i = 0; i < 15; i++) { const n = pick(NAMES); await submit(job.slug, { name: n, email: emailFor(n), years: pick([2, 3, 4, 5, 6, 7, 8, 10]), why: pick(["I love crafting delightful, accessible interfaces and Frame's design bar matches mine.", "Ten years in SaaS design; I want to shape a product from the ground up.", "Your product philosophy resonates with me and I'd bring strong systems thinking."]) }); }
  console.log("  ✓ Job form + 15 responses");

  const evt = await makeForm("Frame Launch Party 🎉", { description: "Join us — Sept 20, SF.", settings: { theme: { accent: "#E1663E", radius: "lg" } }, blocks: [
    { id: "name", type: "short", label: "Your name", required: true },
    { id: "email", type: "email", label: "Email", required: true },
    { id: "attending", type: "choice", label: "Will you attend?", required: true, options: ["Yes, I'll be there", "Maybe", "Can't make it"] },
    { id: "guests", type: "number", label: "How many guests?", required: false },
    { id: "diet", type: "checkbox", label: "Dietary preferences", required: false, options: ["Vegetarian", "Vegan", "Gluten-free", "No restrictions"] }] });
  await events(evt.slug, 260, 150);
  for (let i = 0; i < 19; i++) { const n = pick(NAMES); await submit(evt.slug, { name: n, email: emailFor(n), attending: pick(["Yes, I'll be there", "Yes, I'll be there", "Maybe", "Can't make it"]), guests: pick([0, 1, 1, 2, 0, 1]), diet: [pick(["Vegetarian", "Vegan", "Gluten-free", "No restrictions"])] }); }
  console.log("  ✓ Event form + 19 responses");

  await makeForm("Product Roadmap Survey (draft)", { description: "Coming soon.", settings: { theme: { accent: "#2F6BE4" } }, blocks: [{ id: "q", type: "long", label: "What should we build next?", required: true }] }, false);
  console.log("  ✓ Draft form");

  console.log(`\nDONE.  Login:  ${EMAIL}  /  ${PASSWORD}`);
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
