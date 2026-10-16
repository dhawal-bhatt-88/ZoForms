"use client";

import { useEffect, useState } from "react";
import { Loader2, MoreHorizontal, Search, Trash2 } from "lucide-react";
import AdminShell from "@/components/admin-shell";
import { deleteForm, listForms, type AdminForm } from "@/lib/api";

export default function FormsPage() {
  const [rows, setRows] = useState<AdminForm[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminForm | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      listForms(q)
        .then((r) => {
          setRows(r);
          setStatus("ok");
        })
        .catch(() => setStatus("error"));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function onDelete() {
    if (!confirmDel) return;
    setBusy(true);
    try {
      await deleteForm(confirmDel.id);
      setRows((r) => r.filter((x) => x.id !== confirmDel.id));
      setConfirmDel(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Forms">
      <div className="mb-5 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search all forms…"
          className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
      </div>

      {status === "loading" ? (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="overflow-visible rounded-2xl border border-line bg-surface shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wider text-faint">
                <th className="px-4 py-3">Form</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3 text-right">Responses</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((f) => (
                <tr key={f.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="font-medium">{f.title}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{f.org.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{f.responses}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-flex items-center gap-1">
                      <button
                        onClick={() => setMenu(menu === f.id ? null : f.id)}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menu === f.id && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} />
                          <div className="absolute right-0 top-8 z-30 w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                            <button
                              onClick={() => {
                                setConfirmDel(f);
                                setMenu(null);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] font-medium text-red hover:bg-[#FCECEC]"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted">
                    No forms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={() => !busy && setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#FCECEC] text-red">
              <Trash2 className="h-5 w-5" />
            </div>
            <h2 className="font-semibold tracking-tight">Delete “{confirmDel.title}”?</h2>
            <p className="mt-1 text-sm text-muted">
              Permanently removes the form and its responses from {confirmDel.org.name}.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} disabled={busy} className="btn btn-outline btn-sm">
                Cancel
              </button>
              <button onClick={onDelete} disabled={busy} className="btn btn-sm bg-red text-white hover:opacity-90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
