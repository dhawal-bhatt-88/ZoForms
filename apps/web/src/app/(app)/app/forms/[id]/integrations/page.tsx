"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Loader2,
  PenLine,
  Plus,
  Send,
  Trash2,
  Zap,
} from "lucide-react";
import {
  createAutomation,
  deleteAutomation,
  getForm,
  listAutomations,
  testAutomation,
  updateAutomation,
  type Automation,
} from "@/lib/api";

/** The destinations a form can deliver responses to. All are URL-based. */
const DESTINATIONS = [
  {
    key: "webhook",
    name: "Webhook",
    placeholder: "https://example.com/webhooks/frame",
    help: "POST each response as JSON to any endpoint, in real time.",
    defaultName: "New response webhook",
  },
  {
    key: "slack",
    name: "Slack",
    placeholder: "https://hooks.slack.com/services/T000/B000/xxxxxxxx",
    help: "In Slack, create an Incoming Webhook for a channel and paste its URL. Frame posts a formatted message per response.",
    defaultName: "Slack notification",
  },
  {
    key: "google_sheets",
    name: "Google Sheets",
    placeholder: "https://script.google.com/macros/s/…/exec",
    help: "Deploy a Google Apps Script as a Web App and paste its /exec URL. Each response is appended as a row.",
    defaultName: "Google Sheets row",
  },
  {
    key: "zapier",
    name: "Zapier",
    placeholder: "https://hooks.zapier.com/hooks/catch/000000/xxxxxx",
    help: "Use a “Webhooks by Zapier → Catch Hook” trigger and paste its URL. Connect Frame to 6,000+ apps.",
    defaultName: "Zapier",
  },
  {
    key: "make",
    name: "Make",
    placeholder: "https://hook.eu1.make.com/xxxxxxxxxxxx",
    help: "Add a “Custom webhook” trigger in Make (Integromat) and paste its address.",
    defaultName: "Make (Integromat)",
  },
] as const;

type DestKey = (typeof DESTINATIONS)[number]["key"];

function destName(action: string): string {
  return DESTINATIONS.find((d) => d.key === action)?.name ?? "Webhook";
}
function statusTone(s: string | null): string {
  if (!s) return "text-muted";
  if (s.startsWith("2")) return "text-green";
  return "text-red";
}
function statusLabel(a: Automation): string {
  if (!a.lastStatus) return "Never fired";
  const when = a.lastFiredAt ? new Date(a.lastFiredAt).toLocaleString() : "";
  const ok = a.lastStatus.startsWith("2");
  return `${ok ? "Delivered" : "Failed"} (${a.lastStatus})${when ? ` · ${when}` : ""}`;
}

export default function IntegrationsPage() {
  const params = useParams();
  const fid = String(params.id);

  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Automation[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const [dest, setDest] = useState<DestKey>("webhook");
  const [name, setName] = useState("New response webhook");
  const [url, setUrl] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const destination = useMemo(
    () => DESTINATIONS.find((d) => d.key === dest)!,
    [dest],
  );

  async function load() {
    try {
      const [f, list] = await Promise.all([getForm(fid), listAutomations(fid)]);
      setTitle(f.title);
      setRows(list);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);

  function onPickDest(key: DestKey) {
    setDest(key);
    if (!nameEdited) {
      setName(DESTINATIONS.find((d) => d.key === key)!.defaultName);
    }
  }

  async function onAdd() {
    setFormError(null);
    if (!/^https?:\/\/.+/i.test(url.trim())) {
      setFormError("Enter a valid URL starting with http:// or https://");
      return;
    }
    setAdding(true);
    try {
      const a = await createAutomation(fid, {
        name: name.trim() || destination.defaultName,
        action: dest,
        config: { url: url.trim() },
      });
      setRows((r) => [...r, a]);
      setUrl("");
      setNameEdited(false);
      setName(destination.defaultName);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function onToggle(a: Automation) {
    const next = !a.enabled;
    setRows((r) => r.map((x) => (x.id === a.id ? { ...x, enabled: next } : x)));
    try {
      await updateAutomation(a.id, { enabled: next });
    } catch {
      setRows((r) => r.map((x) => (x.id === a.id ? { ...x, enabled: !next } : x)));
    }
  }

  async function onDelete(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    try {
      await deleteAutomation(id);
    } catch {
      load();
    }
  }

  async function onTest(a: Automation) {
    setTesting(a.id);
    setTestResult((t) => ({ ...t, [a.id]: "" }));
    try {
      const res = await testAutomation(a.id);
      setTestResult((t) => ({
        ...t,
        [a.id]: res.ok ? `Sent · ${res.status}` : `Failed · ${res.status}`,
      }));
      load();
    } catch (e) {
      setTestResult((t) => ({ ...t, [a.id]: (e as Error).message }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/app"
          className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-2 hover:bg-surface-3"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="text-xs font-medium text-muted">Connect · Integrations</div>
          <h1 className="text-xl font-semibold tracking-tight">{title || "Form"}</h1>
        </div>
        <Link href="/app/integrations" className="btn btn-ghost btn-sm">
          Browse all
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
          Couldn&apos;t load integrations.
        </div>
      )}

      {status === "ok" && (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent-2" />
            <h2 className="font-semibold tracking-tight">Connected destinations</h2>
          </div>

          {/* trigger -> action workflow header */}
          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 font-medium text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green" /> New response
            </span>
            <ArrowRight className="h-4 w-4 text-faint" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFEDFE] px-3 py-1 font-medium text-accent-2">
              Deliver to {destination.name}
            </span>
          </div>

          {rows.length === 0 && (
            <p className="mb-5 rounded-xl border border-dashed border-line-2 bg-surface-2 px-4 py-6 text-center text-sm text-muted">
              No destinations yet. Pick one below and every new submission will be
              delivered in real time.
            </p>
          )}

          <div className="space-y-3">
            {rows.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3"
              >
                <button
                  onClick={() => onToggle(a)}
                  className={`relative h-5 w-9 flex-none rounded-full transition-colors ${a.enabled ? "bg-accent-2" : "bg-line-2"}`}
                  aria-label={a.enabled ? "Disable" : "Enable"}
                  title={a.enabled ? "Enabled" : "Disabled"}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${a.enabled ? "left-[18px]" : "left-0.5"}`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{a.name}</span>
                    <span className="flex-none rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                      {destName(a.action)}
                    </span>
                  </div>
                  <div className="truncate font-mono text-xs text-faint">{a.config.url}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${statusTone(a.lastStatus)}`}>
                    {testResult[a.id] || statusLabel(a)}
                  </span>
                  <button
                    onClick={() => onTest(a)}
                    disabled={testing === a.id}
                    className="flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink"
                    title="Send a test payload"
                  >
                    {testing === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Test
                  </button>
                  <button
                    onClick={() => onDelete(a.id)}
                    className="text-muted hover:text-red"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* add form */}
          <div className="mt-5 border-t border-line pt-5">
            <span className="mb-2 block text-xs font-medium text-muted">Destination</span>
            <div className="mb-4 flex flex-wrap gap-2">
              {DESTINATIONS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => onPickDest(d.key)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    dest === d.key
                      ? "border-accent bg-accent-weak text-accent-2"
                      : "border-line bg-surface text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Name</span>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameEdited(true);
                  }}
                  className="input w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  {destination.name} URL
                </span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onAdd()}
                  placeholder={destination.placeholder}
                  className="input w-full font-mono text-sm"
                />
              </label>
              <button
                onClick={onAdd}
                disabled={adding}
                className="btn btn-primary btn-sm h-[38px]"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </div>
            {formError && <p className="mt-2 text-sm text-red">{formError}</p>}
            <p className="mt-3 flex items-start gap-1.5 text-xs text-faint">
              <Check className="mt-0.5 h-3.5 w-3.5 flex-none" />
              <span>{destination.help}</span>
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
