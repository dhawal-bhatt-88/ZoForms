import Link from "next/link";
import { Logo } from "./logo";

const links = [
  { label: "Product", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Mockup", href: "/mockup" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3.5">
        <Logo />
        <nav className="ml-4 hidden gap-7 text-sm font-medium text-ink/75 md:flex">
          {links.map((l) => (
            <Link key={l.label} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/app" className="btn btn-ghost btn-sm">
            Log in
          </Link>
          <Link href="/app" className="btn btn-primary btn-sm">
            Start for free
          </Link>
        </div>
      </div>
    </header>
  );
}
