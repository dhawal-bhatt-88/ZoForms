import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://frame.so"),
  title: {
    default: "Frame — Forms that feel like writing",
    template: "%s · Frame",
  },
  description:
    "Frame is the simplest way to build beautiful forms. Type a question, add logic, publish, and collect answers. Free forever, unlimited forms.",
  openGraph: {
    title: "Frame — Forms that feel like writing",
    description:
      "Type a question, add logic, publish, and collect answers. Free forever, unlimited forms.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={hanken.variable}>
      <body>{children}</body>
    </html>
  );
}
