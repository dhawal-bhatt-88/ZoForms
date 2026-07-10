"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import AppShell from "@/components/app-shell";
import {
  billingPortal,
  checkout,
  getBilling,
  type BillingSummary,
  type PlanId,
} from "@/lib/api";

export default function BillingPage() {
  const [data, setData] = useState<BillingSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState<PlanId | "portal" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      setData(await getBilling());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onChoose(plan: PlanId) {
    setBusy(plan);
    setMsg(null);
    try {
      const r = await checkout(plan);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      // Dev mode: plan applied immediately.
      setMsg(`Upgraded to ${plan[0].toUpperCase() + plan.slice(1)} (dev mode — no Stripe key).`);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onManage() {
    setBusy("portal");
    setMsg(null);
    try {
      const r = await billingPortal();
      window.location.href = r.url;
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <AppShell title="Billing">
      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">
          Couldn&apos;t load billing.
        </div>
      )}

      {status === "ok" && data && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">
              You&apos;re on the{" "}
              <span className="font-semibold text-ink">
                {data.plan[0].toUpperCase() + data.plan.slice(1)}
              </span>{" "}
              plan · {data.usage.forms} form{data.usage.forms === 1 ? "" : "s"}.
            </p>
            {data.plan !== "free" && data.managed && (
              <button onClick={onManage} disabled={busy === "portal"} className="btn btn-outline btn-sm">
                {busy === "portal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Manage subscription
              </button>
            )}
          </div>

          {msg && (
            <div className="mb-5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
              {msg}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {data.plans.map((p) => {
              const current = p.id === data.plan;
              const isUpgrade =
                ["free", "pro", "business"].indexOf(p.id) >
                ["free", "pro", "business"].indexOf(data.plan);
              return (
                <div
                  key={p.id}
                  className={`flex flex-col rounded-2xl border p-5 shadow-soft ${
                    current ? "border-accent bg-accent-weak/30" : "border-line bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold tracking-tight">{p.name}</h3>
                    {p.id === "pro" && <Sparkles className="h-4 w-4 text-accent-2" />}
                  </div>
                  <div className="mt-1">
                    <span className="text-3xl font-extrabold tracking-tight">${p.price}</span>
                    <span className="text-sm text-muted">/mo</span>
                  </div>
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-ink-2">
                        <Check className="mt-0.5 h-4 w-4 flex-none text-green" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {current ? (
                      <span className="block rounded-lg bg-surface-3 py-2 text-center text-sm font-semibold text-ink-2">
                        Current plan
                      </span>
                    ) : p.id === "free" ? (
                      <span className="block py-2 text-center text-sm text-muted">
                        {isUpgrade ? "" : "Downgrade via Manage"}
                      </span>
                    ) : (
                      <button
                        onClick={() => onChoose(p.id)}
                        disabled={busy === p.id}
                        className="btn btn-primary w-full"
                      >
                        {busy === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        {isUpgrade ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!data.managed && (
            <p className="mt-4 text-xs text-faint">
              Stripe isn&apos;t configured — plan changes apply immediately for local testing.
            </p>
          )}
        </>
      )}
    </AppShell>
  );
}
