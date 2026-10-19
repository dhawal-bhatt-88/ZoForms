"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, History, Loader2, PenLine, RotateCcw } from "lucide-react";
import {
  getForm,
  listVersions,
  restoreVersion,
  type FormVersion,
} from "@/lib/api";

export default function VersionsPage() {
  const params = useParams();
  const router = useRouter();
  const fid = String(params.id);

  const [title, setTitle] = useState("");
  const [versions, setVersions] = useState<FormVersion[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [restoring, setRestoring] = useState<string | null>(null);

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

  async function onRestore(v: FormVersion) {
    if (!confirm(`Restore version ${v.version}? Its content will be saved as a new version.`))
      return;
    setRestoring(v.id);
    try {
      await restoreVersion(fid, v.id);
      // The editor loads the latest version on mount, which is now the restored one.
      router.push(`/app/forms/${fid}/edit`);
    } catch (e) {
      alert((e as Error).message);
      setRestoring(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/app"
          className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-2 hover:bg-surface-3"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="text-xs font-medium text-muted">Version history</div>
          <h1 className="text-xl font-semibold tracking-tight">{title || "Form"}</h1>
        </div>
        <Link href={`/app/forms/${fid}/edit`} className="btn btn-outline btn-sm">
          <PenLine className="h-4 w-4" /> Edit form
        </Link>
      </div>

      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">
          Couldn&apos;t load version history.
        </div>
      )}

      {status === "ok" && (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-4 w-4 text-accent-2" />
            <h2 className="font-semibold tracking-tight">Saved versions</h2>
          </div>
          {versions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-2 bg-surface-2 px-4 py-6 text-center text-sm text-muted">
              No versions yet. Every time you save, Zowork Forms keeps a restorable version here.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {versions.map((v, i) => (
                <div key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-surface-3 text-sm font-semibold text-ink-2">
                    v{v.version}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {v.label || "Saved"}
                      {i === 0 && (
                        <span className="rounded-full bg-[#E7F6ED] px-2 py-0.5 text-[11px] font-semibold text-green">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(v.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => onRestore(v)}
                    // Restoring the current version would duplicate it; the API rejects that with a 409.
                    disabled={i === 0 || restoring !== null}
                    title={i === 0 ? "This is the current version" : undefined}
                    className="flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-2"
                  >
                    {restoring === v.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
