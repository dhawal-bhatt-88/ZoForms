"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Download, Inbox, Loader2, PenLine, X } from "lucide-react";
import type { Block } from "@formbuilder/form-schema";
import { getForm, listResponses } from "@/lib/api";

type Resp = { id: string; data: Record<string, unknown>; createdAt: string };

function fmt(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (o.name as string) ?? JSON.stringify(v);
  }
  return String(v);
}

export default function ResponsesPage() {
  const params = useParams();
  const fid = String(params.id);

  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [rows, setRows] = useState<Resp[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState<Resp | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const f = await getForm(fid);
        const schema = f.versions[0]?.schema;
        setTitle(f.title);
        setBlocks((schema?.blocks ?? []).filter((b) => b.type !== "heading"));
        setRows(await listResponses(fid));
        setStatus("ok");
      } catch {
        setStatus("error");
      }
    })();
  }, [fid]);

  function exportCsv() {
    const headers = ["Submitted", ...blocks.map((b) => b.label)];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      headers.map(esc).join(","),
      ...rows.map((r) =>
        [new Date(r.createdAt).toLocaleString(), ...blocks.map((b) => fmt(r.data[b.id]))]
          .map(esc)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "responses"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/app"
          className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-2 hover:bg-surface-3"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="text-xs font-medium text-muted">Responses</div>
          <h1 className="text-xl font-semibold tracking-tight">{title || "Form"}</h1>
        </div>
        <Link href={`/app/forms/${fid}/edit`} className="btn btn-outline btn-sm">
          <PenLine className="h-4 w-4" /> Edit form
        </Link>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="btn btn-primary btn-sm disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {status === "loading" && (
        <div className="grid place-items-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl bg-[#FCECEC] px-4 py-3 text-sm text-red">
          Couldn&apos;t load responses.
        </div>
      )}

      {status === "ok" && rows.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center shadow-soft">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-3 text-muted">
            <Inbox className="h-5 w-5" />
          </div>
          <p className="mb-1 font-semibold">No responses yet</p>
          <p className="text-sm text-muted">Share your form — submissions will show up here in real time.</p>
        </div>
      )}

      {status === "ok" && rows.length > 0 && (
        <>
          <p className="mb-3 text-sm text-muted">
            {rows.length} {rows.length === 1 ? "response" : "responses"}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-soft">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-[11.5px] uppercase tracking-wide text-muted">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Submitted</th>
                  {blocks.map((b) => (
                    <th key={b.id} className="whitespace-nowrap px-4 py-3 font-semibold">
                      {b.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setOpen(r)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    {blocks.map((b) => (
                      <td key={b.id} className="max-w-[240px] truncate px-4 py-3">
                        {fmt(r.data[b.id]) || <span className="text-faint">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Detail drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(null)} />
          <aside className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-2xl">
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <div className="flex-1">
                <div className="text-xs text-muted">Submission</div>
                <div className="font-semibold">{new Date(open.createdAt).toLocaleString()}</div>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-auto px-5 py-5">
              <dl className="flex flex-col gap-5">
                {blocks.map((b) => (
                  <div key={b.id}>
                    <dt className="mb-1 text-[12.5px] font-semibold text-muted">{b.label}</dt>
                    <dd className="whitespace-pre-wrap text-[15px]">
                      {fmt(open.data[b.id]) || <span className="text-faint">No answer</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
