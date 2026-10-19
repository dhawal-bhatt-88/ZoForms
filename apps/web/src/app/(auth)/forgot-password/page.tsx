"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button, Input } from "@formbuilder/ui";
import { forgotPassword } from "@/lib/api";

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
    <div>
      <div>
        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green" />
            <h1 className="mt-4 display-sm">Check your email</h1>
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
            <h1 className="display-sm">Reset your password</h1>
            <p className="mt-1 text-sm text-muted">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                  Email
                </label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  className="border-line-2 px-3.5 py-2.5 focus:ring-accent-weak"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
              <Button type="submit" disabled={busy} className="h-11 w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send reset link
              </Button>
            </form>
            <p className="body-sm mt-6 text-graphite">
              <Link href="/login" className="link font-medium">
                Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
