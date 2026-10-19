"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import AppShell from "@/components/app-shell";
import {
  Button,
  Callout,
  ConfirmDialog,
  CopyButton,
  DataTable,
  Field,
  Input,
  Panel,
  Select,
  StatusChip,
  TableSkeleton,
  useToast,
  type Column,
} from "@/components/ui";
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
  OWNER: "Full access, including ownership.",
  ADMIN: "Manages the team and every form.",
  EDITOR: "Creates and edits forms and templates.",
  VIEWER: "Reads forms and templates; changes nothing.",
};
const roleName = (role: Role) => role[0] + role.slice(1).toLowerCase();
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const who = (m: Member) => m.name || m.email;

/**
 * Team: who is in this organisation, what each person may do, and the
 * invites still open. Tables after ZoBlocks' Members screen
 * (github.com/zoworkhq/zoblocks at 9aaefe0, apps/app/src/app/(app)/members/).
 * Owners and admins change roles, remove members and invite; everyone else
 * reads. Every outcome is a toast; removing asks first.
 */
export default function TeamPage() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [myRole, setMyRole] = useState<Role>("VIEWER");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [removing, setRemoving] = useState<Member | null>(null);

  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  async function load() {
    try {
      const self = await me();
      setMyRole(self.role);
      const [m, inv] = await Promise.all([
        listMembers(),
        self.role === "OWNER" || self.role === "ADMIN" ? listInvites() : Promise.resolve([] as Invite[]),
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

  async function onChangeRole(m: Member, next: Role) {
    const prev = m.role;
    setMembers((list) => list.map((x) => (x.userId === m.userId ? { ...x, role: next } : x)));
    try {
      await setMemberRole(m.userId, next);
      toast.show({ tone: "pass", title: `${who(m)} is now ${next === "ADMIN" || next === "EDITOR" || next === "OWNER" ? "an" : "a"} ${roleName(next)}.` });
    } catch (e) {
      setMembers((list) => list.map((x) => (x.userId === m.userId ? { ...x, role: prev } : x)));
      toast.show({ tone: "fail", title: `Couldn't change ${who(m)}'s role.`, detail: (e as Error).message });
    }
  }

  async function onRevoke(inv: Invite) {
    try {
      await revokeInvite(inv.id);
      setInvites((v) => v.filter((i) => i.id !== inv.id));
      toast.show({ tone: "pass", title: `Revoked the invite for ${inv.email}.`, detail: "Its link no longer works. Invite them again for a new one." });
    } catch (e) {
      toast.show({ tone: "fail", title: `Couldn't revoke the invite for ${inv.email}.`, detail: (e as Error).message });
    }
  }

  const memberColumns: Column<Member>[] = [
    {
      key: "member",
      header: "Member",
      cell: (m) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-ink">
            {m.name || m.email}
            {m.isYou && <span className="text-[0.6875rem] font-normal text-graphite">(you)</span>}
            {m.status === "suspended" && <StatusChip>suspended</StatusChip>}
          </p>
          {m.name && <p className="truncate text-[0.75rem] text-graphite">{m.email}</p>}
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: "10rem",
      cell: (m) =>
        canManage && !m.isYou ? (
          <>
            <label htmlFor={`role-${m.userId}`} className="sr-only">
              Role for {who(m)}
            </label>
            <Select id={`role-${m.userId}`} size="sm" value={m.role} onChange={(e) => onChangeRole(m, e.target.value as Role)}>
              {ROLES.filter((r) => r !== "OWNER" || myRole === "OWNER" || m.role === "OWNER").map((r) => (
                <option key={r} value={r} title={ROLE_BLURB[r]}>
                  {roleName(r)}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <StatusChip tone={m.role === "OWNER" ? "accent" : "neutral"}>{roleName(m.role)}</StatusChip>
        ),
    },
    { key: "joined", header: "Joined", width: "8rem", numeric: true, cell: (m) => day(m.joinedAt) },
    ...(canManage
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: "7rem",
            cell: (m: Member) =>
              m.isYou ? null : (
                <Button variant="danger" size="sm" onClick={() => setRemoving(m)} aria-label={`Remove ${who(m)}`}>
                  Remove
                </Button>
              ),
          },
        ]
      : []),
  ];

  const inviteColumns: Column<Invite>[] = [
    { key: "email", header: "Email", cell: (i) => <span className="font-medium text-ink">{i.email}</span> },
    { key: "role", header: "Role", width: "8rem", cell: (i) => <StatusChip>{roleName(i.role)}</StatusChip> },
    { key: "invited", header: "Invited", width: "8rem", numeric: true, cell: (i) => day(i.createdAt) },
    { key: "expires", header: "Expires", width: "8rem", numeric: true, cell: (i) => day(i.expiresAt) },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "7rem",
      cell: (i) => (
        <Button variant="ghost" size="sm" onClick={() => onRevoke(i)} aria-label={`Revoke the invite for ${i.email}`}>
          Revoke
        </Button>
      ),
    },
  ];

  return (
    <AppShell title="Team" lede="Invite teammates and choose what each person can do.">
      {status === "loading" && <TableSkeleton rows={3} columns={3} label="Loading your team" />}
      {status === "error" && (
        <Callout tone="fail" title="Couldn't load your team">
          The API didn&apos;t answer. Reload to try again.
        </Callout>
      )}

      {status === "ok" && (
        <div className="space-y-8">
          {canManage && (
            <InvitePanel
              myRole={myRole}
              onInvited={(invite) => setInvites((v) => [invite, ...v.filter((i) => i.email !== invite.email)])}
            />
          )}

          <section aria-labelledby="members-heading">
            <h2 id="members-heading" tabIndex={-1} className="mb-3 outline-none flex items-baseline gap-2 font-display text-[0.9375rem] font-semibold tracking-[-0.008em]">
              Members <span className="tabular text-[0.8125rem] font-normal text-graphite-soft">{members.length}</span>
            </h2>
            <DataTable caption="Members of this organisation" columns={memberColumns} rows={members} rowKey={(m) => m.userId} />
          </section>

          {canManage && invites.length > 0 && (
            <section aria-labelledby="invites-heading">
              <h2 id="invites-heading" className="mb-3 flex items-baseline gap-2 font-display text-[0.9375rem] font-semibold tracking-[-0.008em]">
                Pending invites <span className="tabular text-[0.8125rem] font-normal text-graphite-soft">{invites.length}</span>
              </h2>
              <DataTable caption="Invites not yet accepted" columns={inviteColumns} rows={invites} rowKey={(i) => i.id} />
            </section>
          )}
        </div>
      )}

      {removing && (
        <ConfirmDialog
          title={`Remove ${who(removing)}?`}
          consequence={`${who(removing)} loses access to this organisation's forms and templates straight away. The forms they made stay. You can invite them again later.`}
          confirmLabel="Remove member"
          onConfirm={async () => {
            await removeMember(removing.userId);
            setMembers((list) => list.filter((x) => x.userId !== removing.userId));
            toast.show({ tone: "pass", title: `Removed ${who(removing)}.` });
            requestAnimationFrame(() => document.getElementById("members-heading")?.focus());
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </AppShell>
  );
}

/** Invite someone by email, with a role; the link is shown to copy until email delivery is set up. */
function InvitePanel({ myRole, onInvited }: { myRole: Role; onInvited: (invite: Invite) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<{ email: string; url: string } | null>(null);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setEmailError("Enter an email address, like name@company.com.");
      return;
    }
    setInviting(true);
    try {
      const { invite, acceptUrl } = await createInvite(email.trim(), role);
      onInvited(invite);
      setLastLink({ email: invite.email, url: acceptUrl });
      setEmail("");
      toast.show({ tone: "pass", title: `Invited ${invite.email} as ${roleName(invite.role).toLowerCase()}.`, detail: "Copy the invite link below and send it to them." });
    } catch (err) {
      toast.show({ tone: "fail", title: `Couldn't invite ${email.trim()}.`, detail: (err as Error).message });
    } finally {
      setInviting(false);
    }
  }

  return (
    <Panel
      id="invite"
      title={
        <span className="flex items-center gap-2">
          <UserPlus aria-hidden="true" className="h-4 w-4 text-brand-deep" />
          Invite a teammate
        </span>
      }
      description="Share the invite link with your teammate. Email delivery starts once Resend is configured."
    >
      <form onSubmit={onInvite} noValidate className="grid gap-4 sm:grid-cols-[1.6fr_1fr_auto] sm:items-start">
        <Field label="Email" error={emailError} required>
          {(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
            />
          )}
        </Field>
        <Field label="Role" hint={ROLE_BLURB[role]} required>
          {(field) => (
            <Select {...field} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.filter((r) => r !== "OWNER" || myRole === "OWNER").map((r) => (
                <option key={r} value={r}>
                  {roleName(r)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" variant="primary" pending={inviting} className="sm:mt-[1.6rem]">
          Invite
        </Button>
      </form>
      {lastLink && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-rule-strong bg-paper-sunk px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[0.75rem] text-ink" title={lastLink.url}>
            {lastLink.url}
          </span>
          <CopyButton value={lastLink.url}>Copy link for {lastLink.email}</CopyButton>
        </div>
      )}
    </Panel>
  );
}
