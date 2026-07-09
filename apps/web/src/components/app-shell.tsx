"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  Settings,
  Zap,
} from "lucide-react";
import { logout, me, type User } from "@/lib/api";

const NAV = [
  { href: "/app", label: "My forms", icon: LayoutGrid, exact: true },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/app/integrations", label: "Integrations", icon: Zap },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export default function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    me().then(setUser).catch(() => {});
  }, []);

  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[236px] flex-none flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-primary text-[15px] font-bold text-white shadow-sm">
            F
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Frame</span>
        </div>

        {/* Workspace */}
        <div className="px-3">
          <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-md bg-gradient-to-br from-accent to-accent-2 text-xs font-bold text-white">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-tight">
                {user?.name || "My workspace"}
              </span>
              <span className="block truncate text-[11px] text-muted">Free plan</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 flex-none text-faint" />
          </button>
        </div>

        <nav className="mt-4 flex flex-col gap-0.5 px-3">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-accent-weak text-accent-2"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon
                  className={`h-[17px] w-[17px] flex-none transition-colors ${
                    active ? "text-accent-2" : "text-muted group-hover:text-ink-2"
                  }`}
                />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-3">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-line hover:bg-surface-2"
            >
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink text-xs font-semibold text-white">
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight">
                  {user?.name || "You"}
                </span>
                <span className="block truncate text-[11px] text-muted">{user?.email}</span>
              </span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-[52px] left-0 z-20 w-full overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                  <button
                    onClick={() => {
                      logout();
                      router.push("/login");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-red"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 flex-none items-center gap-3 border-b border-line bg-surface/80 px-6 backdrop-blur-md">
          <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
