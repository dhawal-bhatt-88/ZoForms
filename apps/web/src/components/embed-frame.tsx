import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

export function EmbedFrame({
  src,
  title,
  subtitle,
}: {
  src: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <Link href="/" className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4" /> Frame
        </Link>
        <div className="hidden text-sm sm:block">
          <span className="font-semibold text-ink">{title}</span>
          {subtitle ? <span className="text-muted"> · {subtitle}</span> : null}
        </div>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline btn-sm ml-auto"
        >
          <ExternalLink className="h-4 w-4" /> Open full page
        </a>
      </header>
      <iframe src={src} title={title} className="w-full flex-1 border-0" />
    </div>
  );
}
