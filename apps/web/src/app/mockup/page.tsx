import type { Metadata } from "next";
import { EmbedFrame } from "@/components/embed-frame";

export const metadata: Metadata = {
  title: "Mockup — Clickable Prototype",
  description: "The clickable, 15-screen product prototype.",
};

export default function MockupPage() {
  return (
    <EmbedFrame
      src="/mockup.html"
      title="Clickable Prototype"
      subtitle="15 screens"
    />
  );
}
