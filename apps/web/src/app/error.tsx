"use client";

import { useEffect } from "react";
import { buttonClasses } from "@/components/ui";

/** Route-level error boundary for the web app. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Where a real deployment would report to Sentry/PostHog.
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <span className="eyebrow text-brand-deep">Something went wrong</span>
        <h1 className="display-sm mt-3">
          This page hit an unexpected error
        </h1>
        <p className="body-sm mt-2 text-graphite">
          Try again, or head back home. If it keeps happening, let us know.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className={buttonClasses({ variant: "primary" })}>
            Try again
          </button>
          <a href="/" className={buttonClasses()}>
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
