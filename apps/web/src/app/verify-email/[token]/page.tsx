"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { verifyEmail } from "@/lib/api";
import { Logo } from "@/components/marketing/logo";

export default function VerifyEmailPage() {
  const params = useParams();
  const token = String(params.token);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    verifyEmail(token)
      .then(() => setState("ok"))
      .catch((e) => {
        setState("error");
        setMessage((e as Error).message);
      });
  }, [token]);

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
          {state === "loading" && (
            <div className="grid place-items-center py-6 text-muted">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="mt-3 text-sm">Verifying your email…</p>
            </div>
          )}
          {state === "ok" && (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-green" />
              <h1 className="mt-4 text-xl font-semibold tracking-tight">Email verified</h1>
              <p className="mt-1 text-sm text-muted">Your email address is confirmed.</p>
              <Link href="/app" className="btn btn-primary mt-6 w-full">
                Go to your dashboard
              </Link>
            </>
          )}
          {state === "error" && (
            <>
              <XCircle className="mx-auto h-10 w-10 text-red" />
              <h1 className="mt-4 text-xl font-semibold tracking-tight">
                Couldn&apos;t verify
              </h1>
              <p className="mt-1 text-sm text-muted">{message}</p>
              <Link href="/app" className="btn btn-outline mt-6 w-full">
                Back to dashboard
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
