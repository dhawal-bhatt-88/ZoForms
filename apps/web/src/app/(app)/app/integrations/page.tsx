"use client";

import AppShell from "@/components/app-shell";
import {
  Database,
  Mail,
  MessageSquare,
  Sheet,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";

type Integration = {
  key: string;
  name: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  available: boolean;
};

const INTEGRATIONS: Integration[] = [
  {
    key: "webhook",
    name: "Webhooks",
    blurb: "POST every new response as JSON to any endpoint, in real time.",
    icon: Webhook,
    tint: "bg-[#EFEDFE] text-accent-2",
    available: true,
  },
  {
    key: "slack",
    name: "Slack",
    blurb: "Post a message to a channel whenever a form is submitted.",
    icon: MessageSquare,
    tint: "bg-[#FBEAF0] text-[#C63B7B]",
    available: false,
  },
  {
    key: "sheets",
    name: "Google Sheets",
    blurb: "Append each response as a new row in a spreadsheet.",
    icon: Sheet,
    tint: "bg-[#E7F6ED] text-green",
    available: false,
  },
  {
    key: "email",
    name: "Email notifications",
    blurb: "Get an email digest or per-response alert for your team.",
    icon: Mail,
    tint: "bg-[#FBF0D9] text-amber",
    available: false,
  },
  {
    key: "notion",
    name: "Notion",
    blurb: "Create a database item for every submission.",
    icon: Database,
    tint: "bg-surface-3 text-ink-2",
    available: false,
  },
  {
    key: "zapier",
    name: "Zapier",
    blurb: "Connect Frame to 6,000+ apps with no-code automations.",
    icon: Workflow,
    tint: "bg-[#FCECEC] text-red",
    available: false,
  },
];

export default function MarketplacePage() {
  return (
    <AppShell title="Integrations">
      <p className="mb-5 text-sm text-muted">Send responses where your team already works.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((it) => {
          const Icon = it.icon;
          return (
            <div
              key={it.key}
              className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-soft"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${it.tint}`}>
                  <Icon className="h-5 w-5" />
                </span>
                {it.available ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F6ED] px-2.5 py-0.5 text-xs font-semibold text-green">
                    <Zap className="h-3 w-3" /> Available
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-muted">
                    Soon
                  </span>
                )}
              </div>
              <h3 className="font-semibold tracking-tight">{it.name}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{it.blurb}</p>
              {it.available ? (
                <p className="mt-4 text-sm font-medium text-accent-2">
                  Open any form → <span className="font-semibold">Connect</span> to set up
                </p>
              ) : (
                <button
                  disabled
                  className="mt-4 cursor-not-allowed rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium text-faint"
                >
                  Coming soon
                </button>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
