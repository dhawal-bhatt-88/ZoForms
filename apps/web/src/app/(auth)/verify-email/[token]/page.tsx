"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { verifyEmail } from "@/lib/api";
import { buttonClasses } from "@/components/ui";

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
    <div className="text-center">
      <div>
        {state === "loading" && (
          <div role="status" className="grid place-items-center py-6 text-graphite">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
            <p className="mt-3 text-sm">Verifying your email…</p>
          </div>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 aria-hidden="true" className="mx-auto h-10 w-10 text-pass" />
            <h1 className="mt-4 display-sm">Email verified</h1>
            <p className="body-sm mt-2 text-graphite">Your email address is confirmed.</p>
            <Link href="/app" className={buttonClasses({ variant: "primary", className: "mt-6 w-full" })}>
              Go to your dashboard
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle aria-hidden="true" className="mx-auto h-10 w-10 text-fail" />
            <h1 className="mt-4 display-sm">
              Couldn&apos;t verify
            </h1>
            <p className="body-sm mt-2 text-graphite">{message}</p>
            <Link href="/app" className={buttonClasses({ className: "mt-6 w-full" })}>
              Back to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
