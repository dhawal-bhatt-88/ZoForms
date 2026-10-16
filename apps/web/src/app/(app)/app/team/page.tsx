"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import AppShell from "@/components/app-shell";
import {
  createInvite,
  listInvites,
  listMembers,
  me,
  removeMember,
  revokeInvite,
  setMemberRole,
  type Invite,
  type Member,
  type Role,
} from "@/lib/api";

const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
const ROLE_BLURB: Record<Role, string> = {
  OWNER: "Full access, incl. ownership",
  ADMIN: "Manage team, forms & settings",
  EDITOR: "Create and edit forms",
  VIEWER: "Read-only access to forms & templates",
};

function roleBadge(role: Role): string {
  switch (role) {
    case "OWNER":
      return "bg-accent-weak text-accent-2";
    case "ADMIN":
      return "bg-[#E7F6ED] text-green";
    case "EDITOR":
      return "bg-[#FBF0D9] text-amber";
    default:
      return "bg-surface-3 text-ink-2";
  }
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [myRole, setMyRole] = useState<Role>("VIEWER");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  async function load() {
    try {
      const who = await me();
      setMyRole(who.role);
      const [m, inv] = await Promise.all([
        listMembers(),
        who.role === "OWNER" || who.role === "ADMIN"
          ? listInvites()
          : Promise.resolve([] as Invite[]),
      ]);
      setMembers(m);
      setInvites(inv);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onInvite() {
    setInviteErr(null);
    setLastLink(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setInviteErr("Enter a valid email address.");
      return;
    }
    setInviting(true);
    try {
      const { invite, acceptUrl } = await createInvite(email.trim(), role);
      setInvites((v) => [invite, ...v.filter((i) => i.email !== invite.email)]);
      setLastLink(acceptUrl);
      setEmail("");
    } catch (e) {
      setInviteErr((e as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function onChangeRole(m: Member, next: Role) {
    const prev = m.role;
    setMembers((list) =>
      list.map((x) => (x.userId === m.userId ? { ...x, role: next } : x)),
    );
    try {
      await setMemberRole(m.userId, next);
    } catch (e) {
      setMembers((list) =>
        list.map((x) => (x.userId === m.userId ? { ...x, role: prev } : x)),
      );
      alert((e as Error).message);
    }
  }

  async function onRemove(m: Member) {
    if (!confirm(`Remove ${m.email} from the team?`)) return;
    const snapshot = members;
    setMembers((list) => list.filter((x) => x.userId !== m.userId));
    try {
      await removeMember(m.userId);
    } catch (e) {
      setMembers(snapshot);
      alert((e as Error).message);
    }
  }

  async function onRevoke(inv: Invite) {
    setInvites((v) => v.filter((i) => i.id !== inv.id));
    try {
      await revokeInvite(inv.id);
    } catch {
      load();
    }
  }

  function copyLink() {
    if (!lastLink) return;
    navigator.clipboard.writeText(lastLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <AppShell title="Team">
      <p className="mb-5 text-sm text-muted">
        Invite teammates and control what each person can do.
      </p>

      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">
          Couldn&apos;t load your team.
        </div>
      )}

      {status === "ok" && (
        <div className="space-y-6">
          {/* Invite */}
          {canManage && (
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
              <div className="mb-4 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-accent-2" />
                <h2 className="font-semibold tracking-tight">Invite a teammate</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Email</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onInvite()}
                    placeholder="teammate@company.com"
                    className="input w-full"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Role</span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="input w-full"
                  >
                    {ROLES.filter((r) => r !== "OWNER" || myRole === "OWNER").map((r) => (
                      <option key={r} value={r}>
                        {r[0] + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <button onClick={onInvite} disabled={inviting} className="btn btn-primary btn-sm h-[38px]">
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Invite
                </button>
              </div>
              <p className="mt-2 text-xs text-faint">{ROLE_BLURB[role]}</p>
              {inviteErr && <p className="mt-2 text-sm text-red">{inviteErr}</p>}
              {lastLink && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-line-2 bg-surface-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">{lastLink}</span>
                  <button onClick={copyLink} className="btn btn-outline btn-sm">
                    {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              )}
              <p className="mt-2 text-xs text-faint">
                Share the invite link with your teammate (email delivery activates once Resend is configured).
              </p>
            </section>
          )}

          {/* Members */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <h2 className="mb-4 font-semibold tracking-tight">
              Members <span className="text-muted">({members.length})</span>
            </h2>
            <div className="divide-y divide-line">
              {members.map((m) => (
                <div key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-weak text-sm font-semibold text-accent-2">
                    {(m.name || m.email)[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{m.name || m.email}</span>
                      {m.isYou && <span className="text-xs text-faint">you</span>}
                      {m.status === "suspended" && (
                        <span className="rounded-full bg-[#FCECEC] px-2 py-0.5 text-[11px] font-semibold text-red">
                          suspended
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted">{m.email}</div>
                  </div>
                  {canManage && !m.isYou ? (
                    <select
                      value={m.role}
                      onChange={(e) => onChangeRole(m, e.target.value as Role)}
                      className="input h-9 w-[130px] py-1 text-sm"
                    >
                      {ROLES.filter((r) => r !== "OWNER" || myRole === "OWNER" || m.role === "OWNER").map((r) => (
                        <option key={r} value={r}>
                          {r[0] + r.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge(m.role)}`}>
                      {m.role[0] + m.role.slice(1).toLowerCase()}
                    </span>
                  )}
                  {canManage && !m.isYou && (
                    <button
                      onClick={() => onRemove(m)}
                      className="text-muted hover:text-red"
                      aria-label="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Pending invites */}
          {canManage && invites.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
              <h2 className="mb-4 font-semibold tracking-tight">
                Pending invites <span className="text-muted">({invites.length})</span>
              </h2>
              <div className="divide-y divide-line">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-surface-3 text-muted">
                      <Mail className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{inv.email}</div>
                      <div className="text-xs text-muted">
                        Invited as {inv.role[0] + inv.role.slice(1).toLowerCase()} · expires{" "}
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button onClick={() => onRevoke(inv)} className="btn btn-ghost btn-sm text-muted">
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
