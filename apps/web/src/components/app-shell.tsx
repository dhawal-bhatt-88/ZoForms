"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { logout, me, resendVerification } from "@/lib/api";
import { Rail } from "@/components/rail";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageHeader } from "@/components/page-header";

type Me = Awaited<ReturnType<typeof me>>;

/**
 * The signed-in shell: a rail that never changes, a thin sticky account bar,
 * and the page, opened by a PageHeader built from `title` and `actions`.
 *
 * Layout ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/app/(app)/layout.tsx. Compare against it on the next sync.
 * The rail is where you can go; the bar is who you are and the way out.
 * Content keeps the builder's 1200px measure (ZoBlocks': 900px) for the card
 * grids.
 */
export default function AppShell({
  title,
  eyebrow,
  lede,
  actions,
  children,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    me().then(setUser).catch(() => {});
  }, []);

  async function onResend() {
    try {
      const r = await resendVerification();
      setVerifyMsg(r.alreadyVerified ? "Already verified." : "Verification email sent.");
    } catch {
      setVerifyMsg("Couldn't send — try again.");
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* Sticky and full height on a wide screen; a plain block on a narrow one. */}
      <div className="shrink-0 border-b border-rule px-5 py-5 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <Rail />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* A <header>, so the bar is the page's banner landmark (ZoBlocks' is a div). */}
        <header className="sticky top-0 z-30 flex min-h-[3.25rem] items-center justify-end gap-3 border-b border-rule bg-paper/85 px-5 py-2.5 backdrop-blur-md sm:px-8 lg:px-10">
          <ThemeToggle />
          {user ? (
            <AccountMenu
              name={user.name ?? ""}
              email={user.email}
              role={user.role.toLowerCase()}
              onLogout={() => {
                logout();
                router.push("/login");
              }}
            />
          ) : (
            <span aria-hidden="true" className="h-[2.375rem] w-[2.375rem] rounded-full border border-rule bg-paper-sunk" />
          )}
        </header>

        {user && !user.emailVerified && !dismissed && (
          <div className="border-b border-warn/25 bg-warn-wash">
            <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-[0.8125rem] sm:px-8 lg:px-10">
              <span className="font-medium text-warn">Verify your email</span>
              <span className="text-graphite">{verifyMsg || "Confirm your address to secure your account."}</span>
              {!verifyMsg && (
                <button onClick={onResend} className="link font-medium">
                  Resend link
                </button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="ml-auto grid h-6 w-6 place-items-center rounded-md text-graphite hover:bg-paper-sunk hover:text-ink"
                aria-label="Dismiss"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-[1200px]">
            <PageHeader eyebrow={eyebrow} title={title} lede={lede} actions={actions} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
