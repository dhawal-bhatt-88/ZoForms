"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, PenLine, RotateCcw } from "lucide-react";
import {
  Button,
  buttonClasses,
  Callout,
  ConfirmDialog,
  DataTable,
  EmptyState,
  StatusChip,
  TableSkeleton,
  useToast,
  type Column,
} from "@/components/ui";
import { getForm, listVersions, restoreVersion, type FormVersion } from "@/lib/api";

/**
 * A form's saved versions, newest first. Restoring one saves its content as a
 * new version and opens the editor on it; it asks first, and the outcome is a
 * toast (the (app) layout's provider carries it into the editor).
 */
export default function VersionsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const fid = String(params.id);

  const [title, setTitle] = useState("");
  const [versions, setVersions] = useState<FormVersion[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [restoring, setRestoring] = useState<FormVersion | null>(null);

  async function load() {
    try {
      const [f, v] = await Promise.all([getForm(fid), listVersions(fid)]);
      setTitle(f.title);
      setVersions(v);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);

  const current = versions[0];
  const columns: Column<FormVersion>[] = [
    {
      key: "version",
      header: "Version",
      width: "8rem",
      cell: (v) => (
        <span className="flex items-center gap-2">
          <span className="tabular font-mono text-[0.8125rem] font-medium text-ink">v{v.version}</span>
          {v.id === current?.id && <StatusChip tone="pass">Current</StatusChip>}
        </span>
      ),
    },
    { key: "label", header: "Saved as", cell: (v) => <span className="text-ink">{v.label || "Saved"}</span> },
    {
      key: "saved",
      header: "Saved",
      width: "12rem",
      numeric: true,
      cell: (v) => <span className="text-graphite">{new Date(v.createdAt).toLocaleString()}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "13rem",
      cell: (v) => (
        <Button
          size="sm"
          onClick={() => setRestoring(v)}
          // Restoring the current version would only duplicate it; the API refuses that (409).
          reason={v.id === current?.id ? "This is the current version." : undefined}
          aria-label={`Restore v${v.version}`}
        >
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          Restore
        </Button>
      ),
    },
  ];

  return (
    // The header sits outside <main>, so it is the page's banner landmark.
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-rule pb-6">
        <Link
          href="/app"
          className="grid h-9 w-9 flex-none place-items-center rounded-lg text-graphite transition-colors duration-200 hover:bg-paper-sunk hover:text-ink"
          aria-label="Back"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1 basis-[16rem]">
          <p className="eyebrow mb-2 text-brand-deep">Version history</p>
          <h1 className="display-sm">{title || "Form"}</h1>
        </div>
        <Link href={`/app/forms/${fid}/edit`} className={buttonClasses({ size: "sm" })}>
          <PenLine aria-hidden="true" className="h-3.5 w-3.5" /> Edit form
        </Link>
      </header>

      <main>
        {status === "loading" && <TableSkeleton rows={3} columns={4} label="Loading saved versions" />}
        {status === "error" && (
          <Callout tone="fail" title="Couldn't load version history">
            The API didn&apos;t answer. Reload to try again.
          </Callout>
        )}

        {status === "ok" && (
          <section aria-labelledby="versions-heading">
            <h2 id="versions-heading" className="mb-1 font-display text-[0.9375rem] font-semibold tracking-[-0.008em]">
              Saved versions
            </h2>
            <p className="body-sm mb-4 text-graphite">Every save keeps a version. Restoring one saves its content as a new version.</p>
            <DataTable
              caption={`Versions of ${title || "this form"}`}
              columns={columns}
              rows={versions}
              rowKey={(v) => v.id}
              empty={
                <EmptyState
                  title="No versions yet"
                  body="Every time you save, ZoForms keeps a restorable version here."
                  actions={
                    <Link href={`/app/forms/${fid}/edit`} className={buttonClasses({ variant: "primary", size: "sm" })}>
                      Open the editor
                    </Link>
                  }
                />
              }
            />
          </section>
        )}

        {restoring && current && (
          <ConfirmDialog
            variant="primary"
            title={`Restore v${restoring.version}?`}
            consequence={`Saves v${restoring.version}'s content as a new version, v${current.version + 1}, and opens it in the editor. Every version in between is kept.`}
            confirmLabel="Restore"
            onConfirm={async () => {
              const r = await restoreVersion(fid, restoring.id);
              toast.show({ tone: "pass", title: `Restored v${restoring.version} as v${r.version}.` });
              // The editor loads the latest version on mount, which is now the restored one.
              router.push(`/app/forms/${fid}/edit`);
            }}
            onClose={() => setRestoring(null)}
          />
        )}
      </main>
    </div>
  );
}
