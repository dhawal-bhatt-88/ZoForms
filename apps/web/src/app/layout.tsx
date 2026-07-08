import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Frame — Forms that feel like writing",
    template: "%s · Frame",
  },
  description:
    "Frame is the simplest way to build beautiful forms. Type a question, add logic, publish, and collect answers. Free forever, unlimited forms.",
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
