"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonClasses, Callout, Field, Input, Loading, Skeleton } from "@/components/ui";
import { acceptInvite, getInvite, type InviteInfo } from "@/lib/api";

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
    <div>
      <div>
        {loadError ? (
          <div className="text-center">
            <h1 className="display-sm">Invite unavailable</h1>
            <p className="body-sm mt-2 text-graphite">{loadError}</p>
            <Link href="/login" className={buttonClasses({ className: "mt-6 w-full py-2.5" })}>
              Go to login
            </Link>
          </div>
        ) : !info ? (
          <Loading label="Loading the invite">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-8 h-10 w-full" />
          </Loading>
        ) : (
          <>
            <h1 className="display-sm">
              Join {info.orgName}
            </h1>
            <p className="body-sm mt-2 text-graphite">
              You&apos;ve been invited as{" "}
              <span className="font-semibold text-ink">{roleLabel}</span> ·{" "}
              {info.email}
            </p>

            <form onSubmit={onAccept} className="mt-6 flex flex-col gap-4">
              {info.needsAccount && (
                <Field label="Your name">
                  {(field) => (
                    <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
                  )}
                </Field>
              )}
              <Field label={info.needsAccount ? "Choose a password" : "Your password"} required>
                {(field) => (
                  <Input
                    {...field}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={info.needsAccount ? "At least 6 characters" : "••••••••"}
                    autoComplete={info.needsAccount ? "new-password" : "current-password"}
                  />
                )}
              </Field>

              {err && (
                <Callout role="alert" tone="fail" title="Couldn't accept the invite">
                  {err}
                </Callout>
              )}

              <Button type="submit" variant="primary" pending={busy} pendingLabel="Joining…" className="w-full py-2.5">
                {`Accept & join ${info.orgName}`}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
