"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, FileText, Inbox, Loader2, Send, Users } from "lucide-react";
import AdminShell from "@/components/admin-shell";
import { getOverview, type Overview } from "@/lib/api";

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    getOverview()
      .then((d) => {
        setData(d);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  const maxSignup = data ? Math.max(1, ...data.signups.map((s) => s.count)) : 1;

  return (
    <AdminShell title="Overview">
      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">Couldn&apos;t load platform data.</div>
      )}

      {status === "ok" && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat icon={Building2} label="Tenants" value={data.totals.orgs} />
            <Stat icon={Users} label="Users" value={data.totals.users} />
            <Stat icon={FileText} label="Forms" value={data.totals.forms} />
            <Stat icon={Send} label="Published" value={data.totals.published} />
            <Stat icon={Inbox} label="Responses" value={data.totals.responses} />
          </div>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <h2 className="mb-4 text-sm font-semibold tracking-tight">New users · last 14 days</h2>
            <div className="flex h-28 items-end gap-1.5">
              {data.signups.map((s) => (
                <div
                  key={s.date}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${s.date}: ${s.count} signups`}
                >
                  <div className="flex w-full flex-col justify-end" style={{ height: 84 }}>
                    <div
                      className="w-full rounded-t-sm bg-accent"
                      style={{ height: Math.round((s.count / maxSignup) * 84) }}
                    />
                  </div>
                  <span className="text-[9px] text-faint">{s.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Newest tenants</h2>
              <Link href="/tenants" className="text-[13px] font-medium text-accent-2 hover:underline">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-line">
              {data.recentOrgs.map((o) => (
                <Link
                  key={o.id}
                  href={`/tenants/${o.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-surface-2 text-muted">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">{o.name}</span>
                  <span className="w-24 text-right text-xs text-faint">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}
