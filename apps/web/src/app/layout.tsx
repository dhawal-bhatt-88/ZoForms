import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frame — dev",
  description: "Formbuilder dev scaffold (walking skeleton).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
