"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, Input } from "@formbuilder/ui";
import { GOOGLE_CLIENT_ID, googleLogin, login, signup } from "@/lib/api";
import { GoogleButton } from "@/components/google-button";
import { Logo } from "@/components/logo";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (isSignup) await signup(email, password, name);
      else await login(email, password);
      window.location.href = "/app";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function onGoogle(credential: string) {
    setBusy(true);
    setErr(null);
    try {
      await googleLogin(credential);
      window.location.href = "/app";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  // Auth inputs sit a touch larger than the default; cn() merges these over
  // the shared <Input> base styles (tailwind-merge resolves the conflicts).
  const input = "border-line-2 px-3.5 py-2.5 focus:ring-accent-weak";

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
          <h1 className="text-xl font-semibold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isSignup
              ? "Build forms with logic and scoring, then download them for your app."
              : "Log in to your Zowork Forms workspace."}
          </p>

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="mt-6">
                <GoogleButton onCredential={onGoogle} />
              </div>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs font-medium text-faint">or</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          <form
            onSubmit={onSubmit}
            className={`flex flex-col gap-4 ${GOOGLE_CLIENT_ID ? "" : "mt-6"}`}
          >
            {isSignup && (
              <div>
                <label htmlFor="auth-name" className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                  Name
                </label>
                <Input
                  id="auth-name"
                  className={input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                Email
              </label>
              <Input
                id="auth-email"
                type="email"
                required
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="auth-password" className="block text-[13px] font-semibold text-ink-2">
                  Password
                </label>
                {!isSignup && (
                  <Link
                    href="/forgot-password"
                    className="text-[13px] font-medium text-accent-2 hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="auth-password"
                type="password"
                required
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? "At least 6 characters" : "••••••••"}
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
            </div>

            {err && (
              <p className="rounded-lg bg-[#FCECEC] px-3.5 py-2.5 text-sm text-red">{err}</p>
            )}

            <Button type="submit" disabled={busy} className="h-11 w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-accent-2 hover:underline">
                Log in
              </Link>
            </>
          ) : (
            <>
              New to Zowork Forms?{" "}
              <Link href="/signup" className="font-semibold text-accent-2 hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
