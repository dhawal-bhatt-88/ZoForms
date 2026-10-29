"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Callout, Field, Input } from "@/components/ui";
import { GOOGLE_CLIENT_ID, googleLogin, login, signup, SIGNED_OUT_QUERY } from "@/lib/api";
import { GoogleButton } from "@/components/google-button";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Sent here by a signed-in call the API refused (lib/api.ts).
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    if (!isSignup && window.location.search.slice(1).split("&").includes(SIGNED_OUT_QUERY)) setSignedOut(true);
  }, [isSignup]);

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

  return (
    <div>
      <div>
        <h1 className="display-sm">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="body-sm mt-2 text-graphite">
          {isSignup
            ? "Build forms with logic and scoring, then download them for your app."
            : "Log in to your Zowork Forms workspace."}
        </p>

        {signedOut && (
          <Callout role="status" tone="info" title="Your session has ended. Sign in again to continue." className="mt-5" />
        )}

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="mt-6">
              <GoogleButton onCredential={onGoogle} />
            </div>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-rule" />
              <span className="text-xs font-medium text-graphite-soft">or</span>
              <span className="h-px flex-1 bg-rule" />
            </div>
          </>
        )}

        <form
          onSubmit={onSubmit}
          className={`flex flex-col gap-4 ${GOOGLE_CLIENT_ID ? "" : "mt-7"}`}
        >
          {isSignup && (
            <Field label="Name">
              {(field) => (
                <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
              )}
            </Field>
          )}
          <Field label="Email" required>
            {(field) => (
              <Input
                {...field}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            )}
          </Field>
          <div>
            <Field label="Password" required>
              {(field) => (
                <Input
                  {...field}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? "At least 6 characters" : "••••••••"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
              )}
            </Field>
            {!isSignup && (
              <p className="mt-1.5 text-right text-[0.75rem]">
                <Link href="/forgot-password" className="link">
                  Forgot password?
                </Link>
              </p>
            )}
          </div>

          {err && (
            <Callout role="alert" tone="fail" title={isSignup ? "Couldn't create the account" : "Couldn't log in"}>
              {err}
            </Callout>
          )}

          <Button type="submit" variant="primary" pending={busy} pendingLabel="Please wait…" className="w-full">
            {isSignup ? "Create account" : "Log in"}
          </Button>
        </form>
      </div>

      <p className="body-sm mt-6 text-graphite">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="link font-medium">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to Zowork Forms?{" "}
            <Link href="/signup" className="link font-medium">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
