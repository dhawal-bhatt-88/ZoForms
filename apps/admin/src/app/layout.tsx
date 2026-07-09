import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Frame Admin", template: "%s · Frame Admin" },
  description: "Platform administration console for Frame.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
