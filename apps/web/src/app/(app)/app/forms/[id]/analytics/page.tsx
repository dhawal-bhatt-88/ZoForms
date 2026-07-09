"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Eye,
  Inbox,
  Loader2,
  Monitor,
  MousePointerClick,
  PenLine,
  Smartphone,
  Tablet,
} from "lucide-react";
import { getAnalytics, getForm, type Analytics } from "@/lib/api";

const DEVICE_ICON = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as const;

export default function AnalyticsPage() {
  const params = useParams();
  const fid = String(params.id);
  const [title, setTitle] = useState("");
  const [data, setData] = useState<Analytics | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    (async () => {
      try {
        const [f, a] = await Promise.all([getForm(fid), getAnalytics(fid)]);
        setTitle(f.title);
        setData(a);
        setStatus("ok");
      } catch {
        setStatus("error");
      }
    })();
  }, [fid]);

  const maxDaily = data ? Math.max(1, ...data.daily.map((d) => d.views)) : 1;
  const deviceTotal = data
    ? data.byDevice.desktop + data.byDevice.mobile + data.byDevice.tablet
    : 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/app"
          className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-2 hover:bg-surface-3"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="text-xs font-medium text-muted">Analytics · last 14 days</div>
          <h1 className="text-xl font-semibold tracking-tight">{title || "Form"}</h1>
        </div>
        <Link href={`/app/forms/${fid}/responses`} className="btn btn-ghost btn-sm">
          <Inbox className="h-4 w-4" /> Responses
        </Link>
        <Link href={`/app/forms/${fid}/edit`} className="btn btn-outline btn-sm">
          <PenLine className="h-4 w-4" /> Edit form
        </Link>
      </div>

      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">
          Couldn&apos;t load analytics.
        </div>
      )}

      {status === "ok" && data && (
        <div className="space-y-6">
          {/* metric cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric icon={Eye} label="Views" value={data.views} />
            <Metric icon={MousePointerClick} label="Starts" value={data.starts} sub={`${data.startRate}% of views`} />
            <Metric icon={Inbox} label="Submissions" value={data.submissions} />
            <Metric
              icon={MousePointerClick}
              label="Completion rate"
              value={`${data.completionRate}%`}
              accent
            />
          </div>

          {data.views === 0 && (
            <div className="rounded-xl border border-dashed border-line-2 bg-surface-2 px-4 py-6 text-center text-sm text-muted">
              No traffic yet. Share your form link — views, starts and completion will show up here.
            </div>
          )}

          {/* funnel */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <h2 className="mb-4 text-sm font-semibold tracking-tight">Conversion funnel</h2>
            <div className="space-y-3">
              {[
                { label: "Views", val: data.views, color: "#C7CBF6" },
                { label: "Starts", val: data.starts, color: "#9B8DFB" },
                { label: "Submissions", val: data.submissions, color: "#6D5EFA" },
              ].map((s) => {
                const pct = data.views > 0 ? Math.round((s.val / data.views) * 100) : 0;
                return (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="w-24 flex-none text-sm text-muted">{s.label}</div>
                    <div className="h-8 flex-1 overflow-hidden rounded-lg bg-surface-2">
                      <div
                        className="flex h-full items-center rounded-lg px-2 text-xs font-semibold text-white transition-all"
                        style={{ width: `${Math.max(pct, s.val > 0 ? 6 : 0)}%`, background: s.color }}
                      >
                        {s.val > 0 ? s.val : ""}
                      </div>
                    </div>
                    <div className="w-12 flex-none text-right text-sm font-medium tabular-nums text-ink-2">
                      {pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* trend */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Daily traffic</h2>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#C7CBF6]" /> Views
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Submissions
                </span>
              </div>
            </div>
            <div className="flex items-end gap-1.5">
              {data.daily.map((d) => (
                <div
                  key={d.date}
                  className="group flex flex-1 flex-col items-center gap-1"
                  title={`${d.date}: ${d.views} views, ${d.submissions} submissions`}
                >
                  <div className="flex w-full flex-col justify-end" style={{ height: 100 }}>
                    <div
                      className="w-full rounded-t-sm bg-[#C7CBF6]"
                      style={{ height: Math.round((d.views / maxDaily) * 100) }}
                    />
                    <div
                      className="w-full rounded-b-sm bg-accent"
                      style={{ height: Math.round((d.submissions / maxDaily) * 100) }}
                    />
                  </div>
                  <span className="text-[9px] text-faint">{d.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* device + source */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
              <h2 className="mb-4 text-sm font-semibold tracking-tight">Devices</h2>
              <div className="space-y-3">
                {(["desktop", "mobile", "tablet"] as const).map((dv) => {
                  const Icon = DEVICE_ICON[dv];
                  const count = data.byDevice[dv];
                  const pct = deviceTotal > 0 ? Math.round((count / deviceTotal) * 100) : 0;
                  return (
                    <div key={dv} className="flex items-center gap-3">
                      <Icon className="h-4 w-4 flex-none text-muted" />
                      <div className="w-16 flex-none text-sm capitalize text-ink-2">{dv}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent-2" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-14 flex-none text-right text-sm tabular-nums text-muted">
                        {count} · {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
              <h2 className="mb-4 text-sm font-semibold tracking-tight">Top sources</h2>
              {data.bySource.length === 0 ? (
                <p className="text-sm text-muted">No source data yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.bySource.map((s) => (
                    <div key={s.source} className="flex items-center justify-between text-sm">
                      <span className="truncate text-ink-2">{s.source}</span>
                      <span className="flex-none font-medium tabular-nums text-muted">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-soft ${
        accent ? "border-accent-weak bg-accent-weak" : "border-line bg-surface"
      }`}
    >
      <div className={`mb-2 flex items-center gap-1.5 text-xs font-medium ${accent ? "text-accent-2" : "text-muted"}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-2xl font-bold tracking-tight tabular-nums ${accent ? "text-accent-2" : "text-ink"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}
