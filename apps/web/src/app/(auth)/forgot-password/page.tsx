"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonClasses, Field, Input } from "@/components/ui";
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
            <CheckCircle2 aria-hidden="true" className="mx-auto h-10 w-10 text-pass" />
            <h1 className="mt-4 display-sm">Check your email</h1>
            <p className="body-sm mt-2 text-graphite">
              If an account exists for <span className="font-medium text-ink">{email}</span>,
              we&apos;ve sent a link to reset your password.
            </p>
            {devLink && (
              <a
                href={devLink}
                className="mt-4 block break-all rounded-lg border border-dashed border-rule-strong bg-paper-sunk px-3 py-2 font-mono text-xs text-brand-deep underline-offset-2 hover:underline"
              >
                {devLink}
              </a>
            )}
            <Link href="/login" className={buttonClasses({ className: "mt-6 w-full" })}>
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="display-sm">Reset your password</h1>
            <p className="body-sm mt-2 text-graphite">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
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
              <Button type="submit" variant="primary" pending={busy} className="w-full">
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
