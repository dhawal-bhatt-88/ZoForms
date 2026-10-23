import { ImageResponse } from "next/og";

/*
 * A placeholder link-preview image for the public pages, until design supplies
 * one: the wordmark and the product line on the light paper ground. Built
 * once at build time. The colours are the light tokens in globals.css
 * (paper, ink, graphite, brand); the mark is ZoBlocksMark in components/logo.tsx.
 */

export const alt = "Zowork Forms: clinical forms that run in your app";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#f7f9f8",
          color: "#08110f",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg viewBox="0 0 28 16" width={126} height={72}>
            <rect x="11.5" y="5.5" width="5" height="5" rx="1.25" fill="#10b995" />
            <rect x="2.5" y="3" width="9.5" height="10" rx="2" fill="none" stroke="#08110f" strokeWidth="2" />
            <rect x="16" y="3" width="9.5" height="10" rx="2" fill="none" stroke="#08110f" strokeWidth="2" />
          </svg>
          <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: "-0.02em" }}>Zowork Forms</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 40, lineHeight: 1.3, color: "#5a6b67", maxWidth: 900 }}>
          Clinical forms, built here, running in your app.
        </div>
      </div>
    ),
    size,
  );
}
