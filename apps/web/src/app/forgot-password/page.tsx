"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button, Input } from "@formbuilder/ui";
import { forgotPassword } from "@/lib/api";
import { Logo } from "@/components/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await forgotPassword(email);
      if (r.resetUrl) setDevLink(r.resetUrl);
    } catch {
      /* never reveal whether the account exists */
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-green" />
              <h1 className="mt-4 text-xl font-semibold tracking-tight">Check your email</h1>
              <p className="mt-1 text-sm text-muted">
                If an account exists for <span className="font-medium text-ink">{email}</span>,
                we&apos;ve sent a link to reset your password.
              </p>
              {devLink && (
                <a
                  href={devLink}
                  className="mt-4 block break-all rounded-lg border border-dashed border-line-2 bg-surface-2 px-3 py-2 font-mono text-xs text-accent-2 hover:underline"
                >
                  {devLink}
                </a>
              )}
              <Link href="/login" className="btn btn-outline mt-6 w-full">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
              <p className="mt-1 text-sm text-muted">
                Enter your email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
                <Input
                  type="email"
                  required
                  className="border-line-2 px-3.5 py-2.5 focus:ring-accent-weak"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
                <Button type="submit" disabled={busy} className="h-11 w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send reset link
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-muted">
                <Link href="/login" className="font-semibold text-accent-2 hover:underline">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
