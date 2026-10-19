"use client";

/**
 * Last-resort boundary that replaces the root layout when it throws, so it must
 * render its own <html>/<body> and can't rely on globals.css loading.
 *
 * So the palette is restated as literals: the ZoBlocks values from
 * apps/web/src/app/globals.css, after github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/app/global-error.tsx. The theme class lives on the document this
 * one replaced, so dark follows `prefers-color-scheme` instead.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          background: "#f7f9f8",
          color: "#08110f",
        }}
      >
        {/* A media query can't go in a style attribute, and this file can't
            import a stylesheet that may be the reason nothing loaded. */}
        <style>{`
          @media (prefers-color-scheme: dark) {
            body { background: #080b10 !important; color: #edf2f7 !important; }
            .ge-muted { color: #a2aebb !important; }
            .ge-btn { background: #6ce7cb !important; color: #080b10 !important; }
          }
        `}</style>
        <div style={{ textAlign: "center", padding: "0 1.5rem", maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
            Something went wrong
          </h1>
          <p className="ge-muted" style={{ color: "#5a6b67", marginTop: "0.5rem" }}>
            A critical error occurred. Please reload the page.
          </p>
          <button
            onClick={reset}
            className="ge-btn"
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.5rem",
              borderRadius: "0.5rem",
              background: "#067662",
              color: "#f7f9f8",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
