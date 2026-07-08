import Link from "next/link";
import { Layers } from "lucide-react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-white">
        <Layers className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-ink">
        Frame
      </span>
    </Link>
  );
}
