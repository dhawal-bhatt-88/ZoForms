"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  Building2,
  Loader2,
  LogIn,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import AdminShell from "@/components/admin-shell";
import { listAudit, type AuditEntry } from "@/lib/api";

function iconFor(action: string) {
  if (action.startsWith("org")) return Building2;
  if (action.includes("impersonat")) return LogIn;
  if (action.includes("deleted")) return Trash2;
  if (action.includes("admin")) return ShieldCheck;
  if (action.startsWith("form")) return Ban;
  return UserCog;
}

function describe(e: AuditEntry): string {
  const m = (e.meta || {}) as Record<string, unknown>;
  switch (e.action) {
    case "org.plan_changed":
      return `changed plan ${m.from} → ${m.to}`;
    case "org.suspended":
      return "suspended a tenant";
    case "org.reactivated":
      return "reactivated a tenant";
    case "user.suspended":
      return "suspended a user";
    case "user.reactivated":
      return "reactivated a user";
    case "user.impersonated":
      return `impersonated ${m.email}`;
    case "user.deleted":
      return `deleted user ${m.email}`;
    case "user.granted_admin":
      return "granted admin access";
    case "user.revoked_admin":
      return "revoked admin access";
    case "form.status_changed":
      return `changed form status ${m.from} → ${m.to}`;
    case "form.deleted":
      return `deleted form “${m.title}”`;
    default:
      return e.action;
  }
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    listAudit()
      .then((r) => {
        setRows(r);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <AdminShell title="Audit log">
      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">Couldn&apos;t load the audit log.</div>
      )}

      {status === "ok" && (
        <div className="rounded-2xl border border-line bg-surface p-2 shadow-soft">
          {rows.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted">No admin actions recorded yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {rows.map((e) => {
                const Icon = iconFor(e.action);
                const danger = e.action.includes("deleted") || e.action.includes("suspended");
                return (
                  <div key={e.id} className="flex items-center gap-3 px-3 py-3">
                    <span
                      className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${
                        danger ? "bg-[#FCECEC] text-red" : "bg-surface-2 text-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <span className="font-medium">{e.actorEmail}</span>{" "}
                        <span className="text-muted">{describe(e)}</span>
                      </div>
                      <div className="font-mono text-[11px] text-faint">{e.action}</div>
                    </div>
                    <span className="flex-none text-xs text-faint">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
