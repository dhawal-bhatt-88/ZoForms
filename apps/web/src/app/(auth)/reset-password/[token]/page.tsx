"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Callout, Field, Input } from "@/components/ui";
import { resetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  const params = useParams();
  const token = String(params.token);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await resetPassword(token, password);
      window.location.href = "/app";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <div>
        <h1 className="display-sm">Choose a new password</h1>
        <p className="body-sm mt-2 text-graphite">Enter a new password for your account.</p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <Field label="New password" required>
            {(field) => (
              <Input
                {...field}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            )}
          </Field>
          {err && (
            <Callout role="alert" tone="fail" title="Couldn't reset the password">
              {err}
            </Callout>
          )}
          <Button type="submit" variant="primary" pending={busy} className="w-full py-2.5">
            Reset password &amp; sign in
          </Button>
        </form>
        <p className="body-sm mt-6 text-graphite">
          <Link href="/login" className="link font-medium">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
