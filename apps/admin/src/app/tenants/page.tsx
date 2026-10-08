"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, Search } from "lucide-react";
import AdminShell from "@/components/admin-shell";
import { listOrgs, type OrgRow } from "@/lib/api";

export default function TenantsPage() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const t = setTimeout(() => {
      listOrgs(q)
        .then((r) => {
          setRows(r);
          setStatus("ok");
        })
        .catch(() => setStatus("error"));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <AdminShell title="Tenants">
      <div className="mb-5 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tenants…"
          className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
      </div>

      {status === "loading" ? (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wider text-faint">
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3 text-right">Members</th>
                <th className="px-4 py-3 text-right">Forms</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => (
                <tr key={o.id} className="group transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${o.id}`} className="flex items-center gap-2.5 font-medium">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-surface-2 text-muted group-hover:bg-accent-weak group-hover:text-accent-2">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="truncate">{o.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{o._count.memberships}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{o.forms}</td>
                  <td className="px-4 py-3">
                    {o.status === "suspended" ? (
                      <span className="rounded-full bg-[#FCECEC] px-2 py-0.5 text-[11px] font-semibold text-red">Suspended</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[13px] text-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-green" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-faint">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    No tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
