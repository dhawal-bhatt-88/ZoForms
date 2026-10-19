"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, Input } from "@formbuilder/ui";
import { resetPassword } from "@/lib/api";
import { Logo } from "@/components/logo";

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
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
          <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted">Enter a new password for your account.</p>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              type="password"
              required
              className="border-line-2 px-3.5 py-2.5 focus:ring-accent-weak"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            {err && (
              <p className="rounded-lg bg-[#FCECEC] px-3.5 py-2.5 text-sm text-red">{err}</p>
            )}
            <Button type="submit" disabled={busy} className="h-11 w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reset password &amp; sign in
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted">
            <Link href="/login" className="font-semibold text-accent-2 hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
