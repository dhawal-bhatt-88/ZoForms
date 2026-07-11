import Link from "next/link";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden>
      <rect width="28" height="28" rx="8" fill="url(#frameGrad)" />
      <path
        d="M9 10.5A1.5 1.5 0 0 1 10.5 9H19M9 14h7M9 17.5h10"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="frameGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C6BFF" />
          <stop offset="1" stopColor="#5546E6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2">
      <span className="inline-block transition-transform duration-300 group-hover:-rotate-6">
        <LogoMark />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-ink">Frame</span>
    </Link>
  );
}
