const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const TENANT_URL = process.env.NEXT_PUBLIC_TENANT_URL || "http://localhost:3000";

const TOKEN_KEY = "frame_admin_token";
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
  if ((res.status === 401 || res.status === 403) && typeof window !== "undefined") {
    if (window.location.pathname !== "/login") {
      logout();
      window.location.href = "/login";
    }
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

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid email or password.");
  const data = (await res.json()) as { token: string };
  setToken(data.token);
  // verify this account is a platform admin
  const check = await fetch(`${API_URL}/v1/admin/overview`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  if (!check.ok) {
    logout();
    throw new Error("This account doesn't have admin access.");
  }
}

/* ---------- types ---------- */

export type Overview = {
  totals: { orgs: number; users: number; forms: number };
  signups: { date: string; count: number }[];
  recentOrgs: { id: string; name: string; status: string; createdAt: string }[];
};

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  forms: number;
  _count: { memberships: number; workspaces: number };
};

export type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  members: { id: string; email: string; name: string | null; role: string; status: string }[];
  forms: { id: string; title: string; createdAt: string }[];
};

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  status: string;
  createdAt: string;
  orgs: { id: string; name: string; role: string }[];
};

export type AdminForm = {
  id: string;
  title: string;
  createdAt: string;
  org: { id: string; name: string };
};

export type AuditEntry = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

/* ---------- endpoints ---------- */

export const getOverview = () => req<Overview>("/v1/admin/overview");
export const listOrgs = (q = "") => req<OrgRow[]>(`/v1/admin/orgs${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const getOrg = (id: string) => req<OrgDetail>(`/v1/admin/orgs/${id}`);
export const updateOrg = (id: string, body: { status?: string }) =>
  req<{ id: string; status: string }>(`/v1/admin/orgs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const listUsers = (q = "") => req<UserRow[]>(`/v1/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const updateUser = (id: string, body: { status?: string; isAdmin?: boolean }) =>
  req<UserRow>(`/v1/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteUser = (id: string) => req<{ ok: boolean }>(`/v1/admin/users/${id}`, { method: "DELETE" });
export const impersonate = (id: string) =>
  req<{ token: string; user: { id: string; email: string } }>(`/v1/admin/users/${id}/impersonate`, {
    method: "POST",
  });
export const listForms = (q = "") => req<AdminForm[]>(`/v1/admin/forms${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const deleteForm = (id: string) => req<{ ok: boolean }>(`/v1/admin/forms/${id}`, { method: "DELETE" });
export const listAudit = () => req<AuditEntry[]>("/v1/admin/audit");
