"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { login } from "@/lib/api";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(email.trim(), pw);
      window.location.href = "/";
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-ink text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[15px] font-semibold tracking-tight">Zowork Forms Admin</div>
            <div className="text-xs text-muted">Platform administration</div>
          </div>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
          <h1 className="mb-1 text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="mb-5 text-sm text-muted">Admin accounts only.</p>

          <label htmlFor="admin-email" className="mb-1.5 block text-[13px] font-medium text-ink-2">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input mb-4 w-full"
            autoFocus
          />
          <label htmlFor="admin-password" className="mb-1.5 block text-[13px] font-medium text-ink-2">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            className="input mb-1 w-full"
          />
          {err && <p className="mt-3 rounded-lg bg-[#FCECEC] px-3 py-2 text-sm text-red">{err}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary mt-5 w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
