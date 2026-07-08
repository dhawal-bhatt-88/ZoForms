import type { Metadata } from "next";
import { EmbedFrame } from "@/components/embed-frame";

export const metadata: Metadata = {
  title: "Docs — Teardown & Blueprint",
  description:
    "The full product, design, and engineering teardown and build blueprint.",
};

export default function DocsPage() {
  return (
    <EmbedFrame
      src="/docs.html"
      title="Product Teardown & Build Blueprint"
      subtitle="18-section report"
    />
  );
}
