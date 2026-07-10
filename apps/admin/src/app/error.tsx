"use client";

import { useEffect } from "react";

/** Route-level error boundary for the admin console. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <span className="eyebrow">Something went wrong</span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">
          The admin console hit an error
        </h1>
        <p className="mt-2 text-sm text-muted">
          Try again, or return to the dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <a href="/" className="btn btn-outline">
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
