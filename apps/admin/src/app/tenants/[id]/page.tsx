"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Power, Sparkles } from "lucide-react";
import AdminShell from "@/components/admin-shell";
import { getOrg, updateOrg, type OrgDetail } from "@/lib/api";

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setOrg(await getOrg(id));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleStatus() {
    if (!org) return;
    const next = org.status === "suspended" ? "active" : "suspended";
    setBusy(true);
    try {
      await updateOrg(id, { status: next });
      setOrg({ ...org, status: next });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Tenant"
      actions={
        <Link href="/tenants" className="btn btn-outline btn-sm">
          <ChevronLeft className="h-4 w-4" /> All tenants
        </Link>
      }
    >
      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">Couldn&apos;t load tenant.</div>
      )}

      {status === "ok" && org && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">{org.name}</h2>
                {org.status === "suspended" && (
                  <span className="rounded-full bg-[#FCECEC] px-2 py-0.5 text-[11px] font-semibold text-red">
                    Suspended
                  </span>
                )}
                {org.hasAiKey && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-weak px-2 py-0.5 text-[11px] font-semibold text-accent-2">
                    <Sparkles className="h-3 w-3" /> AI key
                  </span>
                )}
              </div>
              <p className="mt-0.5 font-mono text-xs text-faint">/{org.slug}</p>
            </div>
            <button
              onClick={toggleStatus}
              disabled={busy}
              className={`btn btn-sm ${org.status === "suspended" ? "btn-primary" : "btn-outline"}`}
            >
              <Power className="h-4 w-4" />
              {org.status === "suspended" ? "Reactivate" : "Suspend"}
            </button>
          </div>

          {/* stat strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info label="Members" value={org.members.length} />
            <Info label="Forms" value={org.forms.length} />
            <Info label="Created" value={new Date(org.createdAt).toLocaleDateString()} />
          </div>

          {/* members */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold tracking-tight">Members ({org.members.length})</h3>
            <div className="divide-y divide-line">
              {org.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-ink text-xs font-semibold text-white">
                    {(m.name || m.email).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name || m.email}</div>
                    <div className="truncate text-xs text-muted">{m.email}</div>
                  </div>
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-muted">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* forms */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold tracking-tight">Forms ({org.forms.length})</h3>
            {org.forms.length === 0 ? (
              <p className="text-sm text-muted">No forms yet.</p>
            ) : (
              <div className="divide-y divide-line">
                {org.forms.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="flex-1 truncate font-medium">{f.title}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="mb-1 text-xs font-medium text-muted">{label}</div>
      <div className="text-lg font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}
