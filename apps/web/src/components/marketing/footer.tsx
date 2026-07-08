import Link from "next/link";
import { Logo } from "./logo";

type FooterLink = { label: string; href: string };

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Mockup", href: "/mockup" },
      { label: "Get started", href: "/app" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs & blueprint", href: "/docs" },
      { label: "Templates", href: "/app" },
      { label: "Changelog", href: "/app" },
      { label: "Status", href: "/app" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/app" },
      { label: "Blog", href: "/app" },
      { label: "Careers", href: "/app" },
      { label: "Contact", href: "/app" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted">
              The simplest way to build beautiful forms. Type a question, hit
              publish, collect answers.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-[13px] font-semibold text-ink">
                {col.title}
              </h4>
              <ul className="space-y-2.5 text-sm text-muted">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Frame. All rights reserved.</span>
          <div className="flex gap-5">
            <Link href="/app" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/app" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/app" className="hover:text-ink">
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
