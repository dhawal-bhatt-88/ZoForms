import type { FormSchema } from "@formbuilder/form-schema";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type FormStatus = "DRAFT" | "PUBLISHED" | "CLOSED";
export type User = { id: string; email: string; name: string | null };

/* ---------- token ---------- */

const TOKEN_KEY = "frame_token";
export function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}
function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function logout() {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

/** A failed API request. `code` is the API's machine-readable reason, when it sends one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Authenticated fetch: adds the token, handles 401, and throws ApiError on failure. */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    logout();
    const p = window.location.pathname;
    if (p.startsWith("/app")) window.location.href = "/login";
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const body = await res.json();
      if (body?.message) message = String(body.message);
      if (typeof body?.code === "string") code = body.code;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code);
  }
  return res;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  return res.json() as Promise<T>;
}

/* ---------- auth ---------- */

export async function signup(email: string, password: string, name?: string) {
  const r = await req<{ token: string; user: User }>("/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  setToken(r.token);
  return r.user;
}

export async function login(email: string, password: string) {
  const r = await req<{ token: string; user: User }>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(r.token);
  return r.user;
}

/** Client-side Google OAuth client id (empty → hide the Google button). */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export async function googleLogin(credential: string) {
  const r = await req<{ token: string; user: User }>("/v1/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  setToken(r.token);
  return r.user;
}

export function forgotPassword(email: string) {
  return req<{ ok: boolean; resetUrl?: string }>("/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  const r = await req<{ token: string; user: User }>("/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
  setToken(r.token);
  return r.user;
}

export type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export function me() {
  return req<User & { role: Role; orgId: string; emailVerified: boolean }>(
    "/v1/auth/me",
  );
}

export function verifyEmail(token: string) {
  return req<{ ok: boolean }>("/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
export function resendVerification() {
  return req<{ ok: boolean; alreadyVerified?: boolean; verifyUrl?: string }>(
    "/v1/auth/resend-verification",
    { method: "POST" },
  );
}

/* ---------- team ---------- */

export type Member = {
  userId: string;
  email: string;
  name: string | null;
  status: string;
  role: Role;
  isYou: boolean;
  joinedAt: string;
};
export type Invite = {
  id: string;
  email: string;
  role: Role;
  status: string;
  createdAt: string;
  expiresAt: string;
};

export function listMembers() {
  return req<Member[]>("/v1/team/members");
}
export function setMemberRole(userId: string, role: Role) {
  return req<Member>(`/v1/team/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}
export function removeMember(userId: string) {
  return req<{ ok: boolean }>(`/v1/team/members/${userId}`, { method: "DELETE" });
}
export function listInvites() {
  return req<Invite[]>("/v1/team/invites");
}
export function createInvite(email: string, role: Role) {
  return req<{ invite: Invite; acceptUrl: string }>("/v1/team/invites", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}
export function revokeInvite(id: string) {
  return req<{ ok: boolean }>(`/v1/team/invites/${id}`, { method: "DELETE" });
}

/* ---------- organization data controls ---------- */

export type OrgSettings = {
  dataRegion: "us" | "eu";
  retentionDays: number;
  brandingHidden: boolean;
  canWhiteLabel: boolean;
};
export function getOrgSettings() {
  return req<OrgSettings>("/v1/settings/org");
}
export function updateOrgSettings(patch: Partial<Omit<OrgSettings, "canWhiteLabel">>) {
  return req<OrgSettings>("/v1/settings/org", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
export function purgeResponses() {
  return req<{ ok: boolean; purged: number }>("/v1/settings/org/purge", {
    method: "POST",
  });
}

/* ---------- billing ---------- */

export type PlanId = "free" | "pro" | "business";
export type PlanDef = {
  id: PlanId;
  name: string;
  price: number;
  maxForms: number | null;
  customDomains: boolean;
  removeBranding: boolean;
  features: string[];
};
export type BillingSummary = {
  plan: PlanId;
  managed: boolean;
  usage: { forms: number };
  plans: PlanDef[];
};

export function getBilling() {
  return req<BillingSummary>("/v1/billing");
}
export function checkout(plan: PlanId) {
  return req<{ url?: string; devMode?: boolean; plan?: PlanId }>("/v1/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}
export function billingPortal() {
  return req<{ url: string }>("/v1/billing/portal", { method: "POST" });
}

/* ---------- custom domains ---------- */

export type Domain = {
  id: string;
  hostname: string;
  status: "pending" | "active" | "error";
  cfHostnameId: string | null;
  lastError: string | null;
  verifiedAt: string | null;
  createdAt: string;
};
export type DomainList = {
  domains: Domain[];
  cnameTarget: string;
  managed: boolean;
};

export function listDomains() {
  return req<DomainList>("/v1/domains");
}
export function addDomain(hostname: string) {
  return req<{ domain: Domain; cnameTarget: string; managed: boolean }>("/v1/domains", {
    method: "POST",
    body: JSON.stringify({ hostname }),
  });
}
export function verifyDomain(id: string) {
  return req<Domain>(`/v1/domains/${id}/verify`, { method: "POST" });
}
export function deleteDomain(id: string) {
  return req<{ ok: boolean }>(`/v1/domains/${id}`, { method: "DELETE" });
}

/* ---------- invite accept (public) ---------- */

export type InviteInfo = {
  email: string;
  role: Role;
  orgName: string;
  needsAccount: boolean;
};
export function getInvite(token: string) {
  return req<InviteInfo>(`/v1/invites/${token}`);
}
export async function acceptInvite(
  token: string,
  password: string,
  name?: string,
) {
  const r = await req<{ token: string; user: User }>(
    `/v1/invites/${token}/accept`,
    { method: "POST", body: JSON.stringify({ password, name }) },
  );
  setToken(r.token);
  return r.user;
}

/* ---------- settings ---------- */

export type Settings = {
  hasAnthropicKey: boolean;
  keyHint: string | null;
  aiModel: string;
  envKeyPresent: boolean;
};

export function getSettings() {
  return req<Settings>("/v1/settings");
}

export function updateSettings(patch: {
  anthropicApiKey?: string | null;
  aiModel?: string | null;
}) {
  return req<Settings>("/v1/settings", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function testAiConnection() {
  return req<{ ok: boolean; model?: string; sample?: string; reason?: string }>(
    "/v1/settings/test-ai",
    { method: "POST" },
  );
}

/* ---------- forms (authenticated) ---------- */

export type FormListItem = {
  id: string;
  title: string;
  slug: string;
  status: FormStatus;
  createdAt: string;
  updatedAt?: string;
  _count?: { responses: number };
};

export type FormDetail = {
  id: string;
  title: string;
  slug: string;
  status: FormStatus;
  createdAt: string;
  updatedAt: string;
  versions: { id: string; version: number; schema: FormSchema }[];
};

export function listForms() {
  return req<FormListItem[]>("/v1/forms");
}

export function createForm(title: string) {
  return req<FormListItem>("/v1/forms", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function getForm(id: string) {
  return req<FormDetail>(`/v1/forms/${id}`);
}

/**
 * Save the schema as a new version. Rejects with ApiError 409 and code
 * "NO_CHANGES" when it matches the current version, or "VERSION_CONFLICT" when
 * another save got there first.
 */
export function saveSchema(id: string, schema: FormSchema) {
  return req<{ ok: boolean; versionId: string; version: number }>(`/v1/forms/${id}/schema`, {
    method: "PUT",
    body: JSON.stringify(schema),
  });
}

/**
 * Download the form's latest *saved* version as a JSON file. Read-only: never
 * saves and never includes unsaved editor changes.
 */
export async function downloadArtifact(id: string) {
  const res = await apiFetch(`/v1/forms/${id}/artifact`);
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "form-schema.json";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function updateForm(
  id: string,
  patch: { title?: string; status?: FormStatus },
) {
  return req<FormListItem>(`/v1/forms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export type FormVersion = {
  id: string;
  version: number;
  label: string | null;
  createdAt: string;
};
export function listVersions(id: string) {
  return req<FormVersion[]>(`/v1/forms/${id}/versions`);
}
/** Save an old version's content as a new version. */
export function restoreVersion(id: string, versionId: string) {
  return req<{ ok: boolean; versionId: string; version: number }>(`/v1/forms/${id}/versions/${versionId}/restore`, {
    method: "POST",
  });
}

export function duplicateForm(id: string) {
  return req<FormListItem>(`/v1/forms/${id}/duplicate`, { method: "POST" });
}

export function deleteForm(id: string) {
  return req<{ ok: boolean }>(`/v1/forms/${id}`, { method: "DELETE" });
}

export function generateForm(prompt: string) {
  return req<FormListItem>("/v1/ai/generate-form", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export function editForm(schema: FormSchema, instruction: string) {
  return req<{ schema: FormSchema; message: string; changes: string[] }>(
    "/v1/ai/edit-form",
    { method: "POST", body: JSON.stringify({ schema, instruction }) },
  );
}

export type LogicSuggestion = { when: string; then: string; rationale?: string };
export function suggestLogic(schema: FormSchema) {
  return req<{ suggestions: LogicSuggestion[]; ai: boolean }>("/v1/ai/suggest-logic", {
    method: "POST",
    body: JSON.stringify({ schema }),
  });
}
export function summarizeResponses(formId: string) {
  return req<{ summary: string; ai: boolean }>("/v1/ai/summarize-responses", {
    method: "POST",
    body: JSON.stringify({ formId }),
  });
}
export function responsesCopilot(formId: string, question: string) {
  return req<{ answer: string; ai: boolean }>("/v1/ai/responses-copilot", {
    method: "POST",
    body: JSON.stringify({ formId, question }),
  });
}
export function translateForm(schema: FormSchema, targetLang: string) {
  return req<{ schema: FormSchema; translated: boolean; note?: string }>(
    "/v1/ai/translate-form",
    { method: "POST", body: JSON.stringify({ schema, targetLang }) },
  );
}

export function listResponses(id: string, q?: string) {
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return req<{ id: string; data: Record<string, unknown>; createdAt: string }[]>(
    `/v1/forms/${id}/responses${qs}`,
  );
}

/* ---------- analytics ---------- */

export type Analytics = {
  views: number;
  starts: number;
  submissions: number;
  completionRate: number;
  startRate: number;
  byDevice: { desktop: number; mobile: number; tablet: number };
  bySource: { source: string; count: number }[];
  daily: { date: string; views: number; submissions: number }[];
};

export function getAnalytics(id: string) {
  return req<Analytics>(`/v1/forms/${id}/analytics`);
}

/** Fire-and-forget page-view / start tracking from the public runtime. */
export function trackEvent(slug: string, type: "view" | "start", source?: string) {
  try {
    fetch(`${API_URL}/v1/public/forms/${slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, source }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/* ---------- automations / integrations ---------- */

export type Automation = {
  id: string;
  formId: string;
  name: string;
  trigger: string;
  action: string;
  config: { url?: string };
  enabled: boolean;
  createdAt: string;
  lastFiredAt: string | null;
  lastStatus: string | null;
};

export function listAutomations(formId: string) {
  return req<Automation[]>(`/v1/forms/${formId}/automations`);
}

export function createAutomation(
  formId: string,
  body: { name: string; action?: string; config: { url: string }; enabled?: boolean },
) {
  return req<Automation>(`/v1/forms/${formId}/automations`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAutomation(
  id: string,
  patch: { name?: string; config?: { url: string }; enabled?: boolean },
) {
  return req<Automation>(`/v1/automations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteAutomation(id: string) {
  return req<{ ok: boolean }>(`/v1/automations/${id}`, { method: "DELETE" });
}

export function testAutomation(id: string) {
  return req<{ ok: boolean; status: string }>(`/v1/automations/${id}/test`, {
    method: "POST",
  });
}

/* ---------- public (form runtime) ---------- */

export type PublicForm = {
  id: string;
  title: string;
  slug: string;
  schema: FormSchema;
  /** false when the org has white-label enabled — hide the "Made with Frame" footer. */
  branding?: boolean;
};

export function getPublicForm(slug: string) {
  return req<PublicForm>(`/v1/public/forms/${slug}`);
}

export function submitResponse(
  slug: string,
  data: Record<string, unknown>,
  opts?: { sessionId?: string; turnstileToken?: string },
) {
  return req<{ ok: boolean; id: string }>(
    `/v1/public/forms/${slug}/responses`,
    { method: "POST", body: JSON.stringify({ data, ...opts }) },
  );
}

/** Best-effort save of an in-progress submission (partial). Never throws to the UI. */
export function savePartial(
  slug: string,
  sessionId: string,
  data: Record<string, unknown>,
) {
  return req<{ ok: boolean }>(`/v1/public/forms/${slug}/partial`, {
    method: "POST",
    body: JSON.stringify({ sessionId, data }),
  }).catch(() => ({ ok: false }));
}

export type UploadedFile = { name: string; url: string; size: number };

export async function uploadFile(file: File): Promise<UploadedFile> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/v1/public/uploads`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json() as Promise<UploadedFile>;
}
