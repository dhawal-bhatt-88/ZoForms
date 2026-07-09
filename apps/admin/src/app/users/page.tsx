"use client";

import { useEffect, useState } from "react";
import { Loader2, LogIn, MoreHorizontal, Search, ShieldCheck, Trash2 } from "lucide-react";
import AdminShell from "@/components/admin-shell";
import {
  deleteUser,
  impersonate,
  listUsers,
  TENANT_URL,
  updateUser,
  type UserRow,
} from "@/lib/api";

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      listUsers(q)
        .then((r) => {
          setRows(r);
          setStatus("ok");
        })
        .catch(() => setStatus("error"));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function onImpersonate(u: UserRow) {
    setMenu(null);
    try {
      const { token } = await impersonate(u.id);
      window.open(`${TENANT_URL}/impersonate?token=${encodeURIComponent(token)}`, "_blank");
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function onToggleStatus(u: UserRow) {
    setMenu(null);
    const next = u.status === "suspended" ? "active" : "suspended";
    setRows((r) => r.map((x) => (x.id === u.id ? { ...x, status: next } : x)));
    try {
      await updateUser(u.id, { status: next });
    } catch {
      setRows((r) => r.map((x) => (x.id === u.id ? { ...x, status: u.status } : x)));
    }
  }

  async function onDelete() {
    if (!confirmDel) return;
    setBusy(true);
    try {
      await deleteUser(confirmDel.id);
      setRows((r) => r.filter((x) => x.id !== confirmDel.id));
      setConfirmDel(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Users">
      <div className="mb-5 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email or name…"
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
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Tenants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-ink text-xs font-semibold text-white">
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{u.name || u.email}</span>
                          {u.isAdmin && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-accent-weak px-1 py-0.5 text-[10px] font-bold uppercase text-accent-2">
                              <ShieldCheck className="h-2.5 w-2.5" /> Admin
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {u.orgs.length ? u.orgs.map((o) => o.name).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.status === "suspended" ? (
                      <span className="rounded-full bg-[#FCECEC] px-2 py-0.5 text-[11px] font-semibold text-red">Suspended</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[13px] text-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-green" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-faint">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setMenu(menu === u.id ? null : u.id)}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-ink"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menu === u.id && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} />
                          <div className="absolute right-0 top-8 z-30 w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                            <button
                              onClick={() => onImpersonate(u)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                            >
                              <LogIn className="h-4 w-4" /> Impersonate
                            </button>
                            <button
                              onClick={() => onToggleStatus(u)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                            >
                              <ShieldCheck className="h-4 w-4" />
                              {u.status === "suspended" ? "Reactivate" : "Suspend"}
                            </button>
                            <div className="my-1 h-px bg-line" />
                            <button
                              onClick={() => {
                                setConfirmDel(u);
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
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    No users found.
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
            <h2 className="font-semibold tracking-tight">Delete {confirmDel.email}?</h2>
            <p className="mt-1 text-sm text-muted">
              This removes the user and their memberships. This can&apos;t be undone.
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
