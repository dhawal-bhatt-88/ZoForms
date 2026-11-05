"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getToken, logout } from "@/lib/api";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/tenants", label: "Tenants", icon: Building2 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/forms", label: "Forms", icon: FileText },
  { href: "/audit", label: "Audit log", icon: ScrollText },
];

function adminEmail(): string {
  try {
    const t = getToken();
    if (!t) return "";
    return JSON.parse(atob(t.split(".")[1])).email || "";
  } catch {
    return "";
  }
}

export default function AdminShell({
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
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setEmail(adminEmail());
  }, [router]);

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 hidden h-screen w-[236px] flex-none flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-ink text-white shadow-sm">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">ZoForms</span>
          <span className="rounded-md bg-accent-weak px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-2">
            Admin
          </span>
        </div>

        <nav className="mt-3 flex flex-col gap-0.5 px-3">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] font-medium transition-colors ${
                  active ? "bg-accent-weak text-accent-2" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon
                  className={`h-[17px] w-[17px] flex-none ${active ? "text-accent-2" : "text-muted group-hover:text-ink-2"}`}
                />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 p-3">
          <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
            <div className="truncate text-[12px] font-medium leading-tight">{email || "Admin"}</div>
            <div className="text-[11px] text-muted">Platform admin</div>
          </div>
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
      </aside>

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
