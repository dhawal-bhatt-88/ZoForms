export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type FormListItem = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  createdAt: string;
  _count?: { responses: number };
};

export async function listForms(): Promise<FormListItem[]> {
  const res = await fetch(`${API_URL}/v1/forms`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function createForm(title: string): Promise<FormListItem> {
  const res = await fetch(`${API_URL}/v1/forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
