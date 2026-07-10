"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2, Lock, Shield, Sparkles, Trash2, X, Zap } from "lucide-react";
import AppShell from "@/components/app-shell";
import {
  getOrgSettings,
  getSettings,
  purgeResponses,
  testAiConnection,
  updateOrgSettings,
  updateSettings,
  type OrgSettings,
  type Settings,
} from "@/lib/api";

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fast & economical (recommended)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — highest quality" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);

  async function load() {
    try {
      const s = await getSettings();
      setSettings(s);
      setModel(s.aiModel);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave() {
    setSaving(true);
    setSaved(false);
    setTest(null);
    try {
      const patch: { anthropicApiKey?: string; aiModel?: string } = { aiModel: model };
      if (key.trim()) patch.anthropicApiKey = key.trim();
      const s = await updateSettings(patch);
      setSettings(s);
      setKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveKey() {
    setSaving(true);
    try {
      const s = await updateSettings({ anthropicApiKey: null });
      setSettings(s);
      setTest(null);
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    setTest(null);
    try {
      const r = await testAiConnection();
      setTest({
        ok: r.ok,
        msg: r.ok
          ? `Connected — ${r.model} replied “${r.sample}”.`
          : r.reason || "Connection failed.",
      });
    } catch (e) {
      setTest({ ok: false, msg: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  const active = settings?.hasAnthropicKey || settings?.envKeyPresent;

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-2xl">
      <p className="mb-6 text-sm text-muted">Workspace configuration</p>

      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">
          Couldn&apos;t load settings.
        </div>
      )}

      {status === "ok" && settings && (
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
          <div className="mb-1 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EFEDFE] text-accent-2">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="font-semibold tracking-tight">AI form generation</h2>
            {active ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#E7F6ED] px-2.5 py-0.5 text-xs font-semibold text-green">
                <Zap className="h-3 w-3" /> Live
              </span>
            ) : (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#FBF0D9] px-2.5 py-0.5 text-xs font-semibold text-amber">
                Heuristic mode
              </span>
            )}
          </div>
          <p className="mb-5 text-sm text-muted">
            Add your Anthropic (Claude) API key to generate forms with a real
            model. Without a key, Frame uses a built-in keyword heuristic.
            Your key is stored per workspace and never sent to the browser.
          </p>

          <label className="mb-1 block text-sm font-medium">Claude API key</label>
          {settings.hasAnthropicKey && !key && (
            <div className="mb-2 flex items-center gap-2 text-sm text-muted">
              <Check className="h-4 w-4 text-green" />
              Key saved (<code className="font-mono">{settings.keyHint}</code>)
              <button
                onClick={onRemoveKey}
                className="ml-2 text-xs font-medium text-red hover:underline"
              >
                Remove
              </button>
            </div>
          )}
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                settings.hasAnthropicKey ? "Enter a new key to replace" : "sk-ant-..."
              }
              className="input w-full pr-10 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              aria-label={showKey ? "Hide" : "Show"}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-faint">
            Get one at{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-accent-2 hover:underline"
            >
              console.anthropic.com
            </a>
            .
          </p>

          <label className="mb-1 mt-5 block text-sm font-medium">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="input w-full"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button onClick={onSave} disabled={saving} className="btn btn-primary btn-sm">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : null}
              {saved ? "Saved" : "Save"}
            </button>
            <button
              onClick={onTest}
              disabled={testing || !active}
              className="btn btn-outline btn-sm"
              title={active ? "Send a tiny request to verify the key" : "Save a key first"}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Test connection
            </button>
          </div>

          {test && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
                test.ok ? "bg-[#E7F6ED] text-green" : "bg-[#FCECEC] text-red"
              }`}
            >
              {test.ok ? (
                <Check className="mt-0.5 h-4 w-4 flex-none" />
              ) : (
                <X className="mt-0.5 h-4 w-4 flex-none" />
              )}
              <span>{test.msg}</span>
            </div>
          )}

          {settings.envKeyPresent && !settings.hasAnthropicKey && (
            <p className="mt-4 text-xs text-faint">
              A server-level <code className="font-mono">ANTHROPIC_API_KEY</code> is
              also active and used as a fallback.
            </p>
          )}
        </section>
      )}

      <OrgDataControls />
      </div>
    </AppShell>
  );
}

function OrgDataControls() {
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [purging, setPurging] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getOrgSettings().then(setOrg).catch(() => {});
  }, []);

  async function save(patch: Partial<OrgSettings>) {
    if (!org) return;
    const prev = org;
    setOrg({ ...org, ...patch });
    try {
      const next = await updateOrgSettings(patch);
      setOrg(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setOrg(prev);
      setMsg((e as Error).message);
    }
  }

  async function onPurge() {
    if (!confirm("Delete all responses older than your retention window now?")) return;
    setPurging(true);
    setMsg(null);
    try {
      const r = await purgeResponses();
      setMsg(`Purged ${r.purged} response${r.purged === 1 ? "" : "s"}.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setPurging(false);
    }
  }

  if (!org) return null;

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Shield className="h-4 w-4 text-accent-2" />
        <h2 className="font-semibold tracking-tight">Data & privacy</h2>
        {saved && <span className="text-xs font-medium text-green">Saved</span>}
      </div>
      <p className="mb-5 text-sm text-muted">
        Residency, retention, and branding for your organization.
      </p>

      <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Data region</label>
      <select
        value={org.dataRegion}
        onChange={(e) => save({ dataRegion: e.target.value as "us" | "eu" })}
        className="input w-full"
      >
        <option value="us">United States (us)</option>
        <option value="eu">European Union (eu)</option>
      </select>

      <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-ink-2">
        Response retention (days)
      </label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={3650}
          defaultValue={org.retentionDays}
          onBlur={(e) => save({ retentionDays: Number(e.target.value) })}
          className="input w-32"
        />
        <button onClick={onPurge} disabled={purging} className="btn btn-outline btn-sm">
          {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Purge now
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        0 keeps responses forever. Older responses are auto-deleted daily.
      </p>

      <label className="mt-4 flex items-start gap-2.5">
        <input
          type="checkbox"
          disabled={!org.canWhiteLabel}
          checked={org.brandingHidden}
          onChange={(e) => save({ brandingHidden: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[#6D5EFA] disabled:opacity-40"
        />
        <span>
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
            White-label {!org.canWhiteLabel && <Lock className="h-3 w-3 text-faint" />}
          </span>
          <span className="block text-xs text-muted">
            Remove the “Made with Frame” footer from your forms.
            {!org.canWhiteLabel && " Requires the Pro or Business plan."}
          </span>
        </span>
      </label>

      {msg && <p className="mt-3 text-sm text-ink-2">{msg}</p>}
    </section>
  );
}
