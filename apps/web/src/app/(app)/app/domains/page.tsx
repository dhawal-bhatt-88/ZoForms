"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import AppShell from "@/components/app-shell";
import {
  addDomain,
  deleteDomain,
  listDomains,
  verifyDomain,
  type Domain,
} from "@/lib/api";

function statusChip(s: Domain["status"]) {
  if (s === "active") return { cls: "bg-[#E7F6ED] text-green", label: "Active" };
  if (s === "error") return { cls: "bg-[#FCECEC] text-red", label: "Error" };
  return { cls: "bg-[#FBF0D9] text-amber", label: "Pending" };
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [cnameTarget, setCnameTarget] = useState("cname.frame.so");
  const [managed, setManaged] = useState(false);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const [hostname, setHostname] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  async function load() {
    try {
      const r = await listDomains();
      setDomains(r.domains);
      setCnameTarget(r.cnameTarget);
      setManaged(r.managed);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onAdd() {
    setErr(null);
    setAdding(true);
    try {
      const r = await addDomain(hostname.trim());
      setDomains((d) => [r.domain, ...d]);
      setHostname("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function onVerify(d: Domain) {
    setVerifying(d.id);
    try {
      const updated = await verifyDomain(d.id);
      setDomains((list) => list.map((x) => (x.id === d.id ? updated : x)));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setVerifying(null);
    }
  }

  async function onDelete(d: Domain) {
    if (!confirm(`Remove ${d.hostname}?`)) return;
    setDomains((list) => list.filter((x) => x.id !== d.id));
    try {
      await deleteDomain(d.id);
    } catch {
      load();
    }
  }

  return (
    <AppShell title="Custom domains">
      <p className="mb-5 text-sm text-muted">
        Serve your forms from your own domain, e.g.{" "}
        <span className="font-mono text-ink-2">forms.acme.com</span>.
      </p>

      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">
          Couldn&apos;t load domains.
        </div>
      )}

      {status === "ok" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-accent-2" />
              <h2 className="font-semibold tracking-tight">Add a domain</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Domain</span>
                <input
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onAdd()}
                  placeholder="forms.acme.com"
                  className="input w-full font-mono text-sm"
                />
              </label>
              <button onClick={onAdd} disabled={adding} className="btn btn-primary btn-sm h-[38px]">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add domain
              </button>
            </div>
            {err && <p className="mt-2 text-sm text-red">{err}</p>}
            <div className="mt-4 rounded-xl border border-dashed border-line-2 bg-surface-2 px-4 py-3 text-sm">
              <p className="font-medium text-ink-2">DNS setup</p>
              <p className="mt-1 text-muted">
                Point a <span className="font-mono">CNAME</span> record at{" "}
                <button
                  className="inline-flex items-center gap-1 font-mono text-accent-2 hover:underline"
                  onClick={() => navigator.clipboard.writeText(cnameTarget)}
                >
                  {cnameTarget} <Copy className="h-3 w-3" />
                </button>
                , then click Verify. {managed
                  ? "SSL is provisioned automatically."
                  : "SSL activates once DNS resolves."}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <h2 className="mb-4 font-semibold tracking-tight">
              Your domains <span className="text-muted">({domains.length})</span>
            </h2>
            {domains.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-2 bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                No custom domains yet.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {domains.map((d) => {
                  const chip = statusChip(d.status);
                  return (
                    <div key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-surface-3 text-ink-2">
                        {d.status === "active" ? (
                          <CheckCircle2 className="h-4 w-4 text-green" />
                        ) : (
                          <Globe className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-sm font-medium">{d.hostname}</div>
                        {d.lastError && (
                          <div className="truncate text-xs text-muted">{d.lastError}</div>
                        )}
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.cls}`}>
                        {chip.label}
                      </span>
                      <button
                        onClick={() => onVerify(d)}
                        disabled={verifying === d.id}
                        className="flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink"
                      >
                        {verifying === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Verify
                      </button>
                      <button
                        onClick={() => onDelete(d)}
                        className="text-muted hover:text-red"
                        aria-label="Remove domain"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
