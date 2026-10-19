"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, Input } from "@formbuilder/ui";
import { acceptInvite, getInvite, type InviteInfo } from "@/lib/api";
import { Logo } from "@/components/logo";

export default function AcceptInvitePage() {
  const params = useParams();
  const token = String(params.token);

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getInvite(token)
      .then(setInfo)
      .catch((e) => setLoadError((e as Error).message));
  }, [token]);

  async function onAccept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await acceptInvite(token, password, name);
      window.location.href = "/app";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const roleLabel = info ? info.role[0] + info.role.slice(1).toLowerCase() : "";

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
          {loadError ? (
            <div className="text-center">
              <h1 className="text-xl font-semibold tracking-tight">Invite unavailable</h1>
              <p className="mt-2 text-sm text-muted">{loadError}</p>
              <Link href="/login" className="btn btn-outline mt-6 w-full">
                Go to login
              </Link>
            </div>
          ) : !info ? (
            <div className="grid place-items-center py-8 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">
                Join {info.orgName}
              </h1>
              <p className="mt-1 text-sm text-muted">
                You&apos;ve been invited as{" "}
                <span className="font-semibold text-ink">{roleLabel}</span> ·{" "}
                {info.email}
              </p>

              <form onSubmit={onAccept} className="mt-6 flex flex-col gap-4">
                {info.needsAccount && (
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                      Your name
                    </label>
                    <Input
                      className="border-line-2 px-3.5 py-2.5 focus:ring-accent-weak"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      autoComplete="name"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                    {info.needsAccount ? "Choose a password" : "Your password"}
                  </label>
                  <Input
                    type="password"
                    required
                    className="border-line-2 px-3.5 py-2.5 focus:ring-accent-weak"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={info.needsAccount ? "At least 6 characters" : "••••••••"}
                    autoComplete={info.needsAccount ? "new-password" : "current-password"}
                  />
                </div>

                {err && (
                  <p className="rounded-lg bg-[#FCECEC] px-3.5 py-2.5 text-sm text-red">{err}</p>
                )}

                <Button type="submit" disabled={busy} className="h-11 w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy ? "Joining…" : `Accept & join ${info.orgName}`}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
