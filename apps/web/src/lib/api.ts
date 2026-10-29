import type { FormSchema, GroupBlock } from "@formbuilder/form-schema";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type User = { id: string; email: string; name: string | null };

/* ---------- token ---------- */

/** Also read before paint by HOME_REDIRECT_SCRIPT (lib/home-redirect.ts). */
export const TOKEN_KEY = "frame_token";
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

/** The sign-in page's `?` when a signed-in call was refused: it says the session has ended. */
export const SIGNED_OUT_QUERY = "signedOut=1";

/**
 * Authenticated fetch: adds the token, handles 401, and throws ApiError on failure.
 * A 401 to a call that carried a token means the session no longer counts (the
 * member was removed, suspended, or the password was reset): the token is
 * cleared and, in the app, the page goes to sign-in, which says why.
 */
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
  if (res.status === 401 && token && typeof window !== "undefined") {
    logout();
    const p = window.location.pathname;
    if (p.startsWith("/app")) window.location.href = `/login?${SIGNED_OUT_QUERY}`;
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
  return req<
    User & {
      role: Role;
      orgId: string;
      emailVerified: boolean;
      /** The editor's settings pane width in px as the author left it; null = the default. */
      settingsPaneWidth: number | null;
    }
  >("/v1/auth/me");
}

/** Sets or clears (null) the signed-in author's settings pane width. */
export function updatePreferences(patch: { settingsPaneWidth: number | null }) {
  return req<{ settingsPaneWidth: number | null }>("/v1/auth/me/preferences", {
    method: "PATCH",
    body: JSON.stringify(patch),
    // Sent even if the page is closed or reloaded right after a resize.
    keepalive: true,
  });
}

export function verifyEmail(token: string) {
  return req<{ ok: boolean }>("/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
export function resendVerification() {
  // emailSent: false when email isn't set up on the server, so nothing went out.
  return req<{ ok: boolean; alreadyVerified?: boolean; emailSent?: boolean; verifyUrl?: string }>(
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
/** acceptUrl comes back only while the server can't send email; then the inviter passes it on. */
export function createInvite(email: string, role: Role) {
  return req<{ invite: Invite; acceptUrl?: string }>("/v1/team/invites", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}
export function revokeInvite(id: string) {
  return req<{ ok: boolean }>(`/v1/team/invites/${id}`, { method: "DELETE" });
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

/* ---------- forms (authenticated) ---------- */

export type FormListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
};

type FormDetail = {
  id: string;
  title: string;
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

/** A new form from a form template: fresh block ids, and `templateRef` naming the template. */
export function createFormFromTemplate(templateId: string) {
  return req<FormListItem>("/v1/forms", {
    method: "POST",
    body: JSON.stringify({ templateId }),
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
  return req<{ ok: boolean; versionId: string; version: number; schema: FormSchema }>(`/v1/forms/${id}/schema`, {
    method: "PUT",
    body: JSON.stringify(schema),
  });
}

/**
 * Download the form's latest *saved* version as a JSON file. Read-only: never
 * saves and never includes unsaved editor changes.
 */
/** Downloads the latest saved version's artifact and returns the file name it was saved as. */
export async function downloadArtifact(id: string): Promise<string> {
  const res = await apiFetch(`/v1/forms/${id}/artifact`);
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "form.json";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return fileName;
}

/* ---------- templates ---------- */

export type TemplateKind = "form" | "group";
/** "system": made by us, read-only. "organisation": the organisation's own, which its authors manage. */
export type TemplateScope = "system" | "organisation";
export type TemplateSummary = {
  id: string;
  kind: TemplateKind;
  name: string;
  description: string | null;
  version: number;
  scope: TemplateScope;
  createdAt: string;
  updatedAt: string;
};
/** With its content: a form schema for a form template, one group block for a group template. */
export type TemplateDetail = TemplateSummary & { content: FormSchema | GroupBlock };

export function listTemplates(kind?: TemplateKind) {
  return req<TemplateSummary[]>(`/v1/templates${kind ? `?kind=${kind}` : ""}`);
}

export function getTemplate(id: string) {
  return req<TemplateDetail>(`/v1/templates/${id}`);
}

export function createTemplate(body: { kind: TemplateKind; name: string; description?: string; content: FormSchema | GroupBlock }) {
  return req<TemplateSummary>("/v1/templates", { method: "POST", body: JSON.stringify(body) });
}

/**
 * Rename, describe, or save new content. Pass the `version` the edit started
 * from with new content: a save made after someone else's is refused with
 * ApiError 409 "VERSION_CONFLICT". Returns the template as stored, content included.
 */
export function updateTemplate(
  id: string,
  patch: { name?: string; description?: string | null; content?: FormSchema | GroupBlock; version?: number },
) {
  return req<TemplateDetail>(`/v1/templates/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteTemplate(id: string) {
  return req<{ ok: boolean }>(`/v1/templates/${id}`, { method: "DELETE" });
}

/** An editable copy in the organisation's templates: "Copy of {name}". */
export function duplicateTemplate(id: string) {
  return req<TemplateSummary>(`/v1/templates/${id}/duplicate`, { method: "POST" });
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
