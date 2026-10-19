"use client";

import { forwardRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui";

/**
 * An in-app link out of the editor that asks first while there are unsaved
 * changes: the App Router has no navigation-blocking API, so the click is
 * held and a `ConfirmDialog` decides. Cancel (or Escape) stays, with focus
 * back on the link; confirming navigates. A click that opens a new tab or
 * window (a modifier key, the middle button) leaves nothing behind, so it
 * isn't asked about. Closing or reloading the tab is the browser's own
 * `beforeunload` warning, the only one browsers allow there.
 */
export const LeaveLink = forwardRef<
  HTMLAnchorElement,
  Omit<React.ComponentProps<typeof Link>, "href" | "onClick"> & { href: string; dirty: boolean }
>(function LeaveLink({ href, dirty, ...props }, ref) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!dirty || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setAsking(true);
  }

  return (
    <>
      <Link {...props} ref={ref} href={href} onClick={onClick} />
      {asking && (
        <ConfirmDialog
          title="Leave without saving?"
          consequence="Your unsaved changes will be lost. This can't be undone."
          confirmLabel="Leave without saving"
          onConfirm={async () => router.push(href)}
          onClose={() => setAsking(false)}
        />
      )}
    </>
  );
});
