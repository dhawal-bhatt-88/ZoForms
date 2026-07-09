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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
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
    try {
      const body = await res.json();
      if (body?.message) message = String(body.message);
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
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

export function me() {
  return req<User>("/v1/auth/me");
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

export function saveSchema(id: string, schema: FormSchema) {
  return req<{ ok: boolean }>(`/v1/forms/${id}/schema`, {
    method: "PUT",
    body: JSON.stringify(schema),
  });
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

export function duplicateForm(id: string) {
  return req<FormListItem>(`/v1/forms/${id}/duplicate`, { method: "POST" });
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

export function listResponses(id: string) {
  return req<{ id: string; data: Record<string, unknown>; createdAt: string }[]>(
    `/v1/forms/${id}/responses`,
  );
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
};

export function getPublicForm(slug: string) {
  return req<PublicForm>(`/v1/public/forms/${slug}`);
}

export function submitResponse(slug: string, data: Record<string, unknown>) {
  return req<{ ok: boolean; id: string }>(
    `/v1/public/forms/${slug}/responses`,
    { method: "POST", body: JSON.stringify({ data }) },
  );
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
