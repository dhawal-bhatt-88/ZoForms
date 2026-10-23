import Link from "next/link";

/**
 * The footer of the public pages. Pages that don't exist yet are named but
 * not linked, marked "soon", rather than links that 404.
 */

/** "Zowork" is plain text until its address is settled; then give it an `href`. */
const COPYRIGHT_HOLDER = "Zowork";

type Item = { label: string; href?: string; external?: boolean; soon?: boolean };

const COLUMNS: { title: string; items: Item[] }[] = [
  { title: "Product", items: [{ label: "Docs", href: "/docs" }, { label: "Release notes", soon: true }] },
  {
    title: "Company",
    items: [{ label: "Zowork" }, { label: "ZoBlocks", href: "https://zoblocks.design", external: true }],
  },
  { title: "Legal", items: [{ label: "Privacy", soon: true }, { label: "Terms", soon: true }] },
];

const linkClass = "text-graphite transition-colors duration-200 hover:text-ink hover:underline";

export function PublicFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="eyebrow text-graphite-soft">{column.title}</h2>
              <ul className="body-sm mt-3 space-y-2">
                {column.items.map((item) => (
                  <li key={item.label}>
                    {!item.href ? (
                      <span className="text-graphite">
                        {item.label}
                        {item.soon && <span className="text-graphite-soft"> (soon)</span>}
                      </span>
                    ) : item.external ? (
                      <a href={item.href} className={linkClass}>
                        {item.label}
                      </a>
                    ) : (
                      <Link href={item.href} className={linkClass}>
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <p className="mt-10 text-[0.75rem] text-graphite-soft">© 2026 {COPYRIGHT_HOLDER}</p>
      </div>
    </footer>
  );
}
