import type { FormSchema } from "@formbuilder/form-schema";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type FormStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

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

export type PublicForm = {
  id: string;
  title: string;
  slug: string;
  schema: FormSchema;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
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

/* ---------- authenticated (app) ---------- */

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

export function listResponses(id: string) {
  return req<{ id: string; data: Record<string, unknown>; createdAt: string }[]>(
    `/v1/forms/${id}/responses`,
  );
}

/* ---------- public (form runtime) ---------- */

export function getPublicForm(slug: string) {
  return req<PublicForm>(`/v1/public/forms/${slug}`);
}

export function submitResponse(slug: string, data: Record<string, unknown>) {
  return req<{ ok: boolean; id: string }>(
    `/v1/public/forms/${slug}/responses`,
    { method: "POST", body: JSON.stringify({ data }) },
  );
}
