import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

/*
 * Fonts and the pre-paint theme script ported from github.com/zoworkhq/zoblocks
 * at 9aaefe0, apps/app/src/app/layout.tsx. Compare against it on the next sync.
 *
 * The same two faces as zoblocks.design: people reach this app from there, and
 * changing the typeface at the boundary makes one family feel like two.
 */
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
  weight: ["400", "500", "600", "700"],
});

/** Codes, names, formulas and other values. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Zowork Forms",
    template: "%s · Zowork Forms",
  },
  description:
    "Build clinical forms with logic and scoring, then download them for your app.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning` covers this one element: the script below adds
    // `dark` to it before React hydrates, so its className legitimately differs
    // from the server's. Children still reconcile and report mismatches.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Inline and synchronous, before first paint, so a reader who chose
            dark never sees a flash of light. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
