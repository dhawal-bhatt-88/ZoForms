"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Loader2, Star, Upload, X } from "lucide-react";
import { resolveTheme, type Block, type ResolvedTheme } from "@formbuilder/form-schema";
import {
  getPublicForm,
  submitResponse,
  uploadFile,
  type PublicForm,
} from "@/lib/api";

type Values = Record<string, unknown>;

const DEFAULT_THEME: ResolvedTheme = resolveTheme(undefined);

export default function PublicFormPage() {
  const params = useParams();
  const slug = String(params.slug);

  const [form, setForm] = useState<PublicForm | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getPublicForm(slug)
      .then((f) => {
        setForm(f);
        setState("ready");
      })
      .catch(() => setState("notfound"));
  }, [slug]);

  function set(id: string, v: unknown) {
    setValues((p) => ({ ...p, [id]: v }));
    setErrors((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const errs: Record<string, string> = {};
    for (const b of form.schema.blocks) {
      if (b.type === "heading") continue;
      const v = values[b.id];
      const empty =
        v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (b.required && empty) errs[b.id] = "This field is required";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      await submitResponse(slug, values);
      const redirect = form.schema.settings?.redirectUrl;
      if (redirect) {
        window.location.href = redirect;
        return;
      }
      setDone(true);
    } catch (err) {
      setErrors({ _form: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  const t = form ? resolveTheme(form.schema.settings?.theme) : DEFAULT_THEME;
  const page = {
    minHeight: "100vh",
    background: t.background,
    fontFamily: t.fontFamily,
  } as React.CSSProperties;

  if (state === "loading")
    return (
      <div style={page} className="grid place-items-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  if (state === "notfound")
    return (
      <div style={page} className="grid place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Form not found</h1>
          <p className="mt-2 text-muted">This form doesn&apos;t exist or isn&apos;t published yet.</p>
        </div>
      </div>
    );

  if (done)
    return (
      <div style={page} className="grid place-items-center px-6">
        <div
          className="w-full max-w-lg border border-line bg-white p-10 text-center shadow-soft"
          style={{ borderRadius: t.radius }}
        >
          <div
            className="mx-auto grid h-12 w-12 place-items-center rounded-full text-white"
            style={{ background: t.accent }}
          >
            <Check className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Thanks — got it!</h1>
          <p className="mt-2 text-muted">Your response to “{form?.title}” was submitted.</p>
          <p className="mt-8 text-xs text-faint">
            Made with <span className="font-semibold text-ink">Frame</span>
          </p>
        </div>
      </div>
    );

  return (
    <div style={page} className="px-6 py-10">
      <form
        onSubmit={onSubmit}
        className="mx-auto w-full max-w-xl border border-line bg-white p-8 shadow-soft sm:p-10"
        style={{ borderRadius: t.radius }}
      >
        <h1 className="text-[26px] font-bold tracking-tight">{form?.title}</h1>
        {form?.schema.description && <p className="mt-1.5 text-muted">{form.schema.description}</p>}

        <div className="mt-7 flex flex-col gap-6">
          {form?.schema.blocks.map((b) => (
            <Field
              key={b.id}
              block={b}
              value={values[b.id]}
              error={errors[b.id]}
              accent={t.accent}
              radius={t.radius}
              onChange={(v) => set(b.id, v)}
            />
          ))}
        </div>

        {errors._form && (
          <p className="mt-5 rounded-lg bg-[#FCECEC] px-4 py-3 text-sm text-red">{errors._form}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: t.accent, borderRadius: t.radius }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Submitting…" : form?.schema.settings?.submitLabel || "Submit"}
        </button>

        <p className="mt-6 text-center text-xs text-faint">
          Made with <span className="font-semibold text-ink">Frame</span>
        </p>
      </form>
    </div>
  );
}

function Field({
  block,
  value,
  error,
  accent,
  radius,
  onChange,
}: {
  block: Block;
  value: unknown;
  error?: string;
  accent: string;
  radius: string;
  onChange: (v: unknown) => void;
}) {
  if (block.type === "heading")
    return <h2 className="mt-2 text-lg font-bold tracking-tight">{block.label}</h2>;

  const inputStyle = { borderRadius: radius } as React.CSSProperties;
  const inputCls = `w-full border px-3.5 py-2.5 text-[15px] outline-none transition-colors ${
    error ? "border-red" : "border-line-2 focus:border-ink"
  }`;
  const tint = `${accent}14`;
  const optStyle = (on: boolean) =>
    ({
      borderRadius: radius,
      borderColor: on ? accent : undefined,
      background: on ? tint : undefined,
    }) as React.CSSProperties;

  return (
    <div>
      <label className="mb-2 block font-semibold">
        {block.label}
        {block.required && <span className="ml-0.5 text-red">*</span>}
      </label>
      {block.description && <p className="mb-2 -mt-1 text-sm text-muted">{block.description}</p>}

      {block.type === "long" ? (
        <textarea
          rows={4}
          className={inputCls}
          style={inputStyle}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : block.type === "dropdown" ? (
        <select
          className={inputCls}
          style={inputStyle}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose…</option>
          {(block.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : block.type === "choice" ? (
        <div className="flex flex-col gap-2">
          {(block.options ?? []).map((o) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-3 border border-line-2 px-3.5 py-2.5 text-[15px] transition-colors hover:border-line"
              style={optStyle(value === o)}
            >
              <input
                type="radio"
                name={block.id}
                checked={value === o}
                onChange={() => onChange(o)}
                style={{ accentColor: accent }}
              />
              {o}
            </label>
          ))}
        </div>
      ) : block.type === "checkbox" ? (
        <div className="flex flex-col gap-2">
          {(block.options ?? []).map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const on = arr.includes(o);
            return (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-3 border border-line-2 px-3.5 py-2.5 text-[15px] transition-colors hover:border-line"
                style={optStyle(on)}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                  style={{ accentColor: accent }}
                />
                {o}
              </label>
            );
          })}
        </div>
      ) : block.type === "rating" ? (
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} stars`}
              className="transition-transform hover:scale-110"
              style={{ color: (value as number) >= n ? accent : "#E2E4E9" }}
            >
              <Star className="h-8 w-8" fill={(value as number) >= n ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      ) : block.type === "file" ? (
        <FileField value={value} onChange={onChange} radius={radius} accent={accent} />
      ) : (
        <input
          type={block.type === "email" ? "email" : block.type === "number" ? "number" : block.type === "date" ? "date" : block.type === "phone" ? "tel" : "text"}
          className={inputCls}
          style={inputStyle}
          placeholder={block.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {error && <p className="mt-1.5 text-sm text-red">{error}</p>}
    </div>
  );
}

function FileField({
  value,
  onChange,
  radius,
  accent,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  radius: string;
  accent: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = value as { name: string; url: string } | undefined;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setErr(null);
    try {
      onChange(await uploadFile(f));
    } catch {
      setErr("Upload failed — try again.");
    } finally {
      setUploading(false);
    }
  }

  if (file?.name)
    return (
      <div
        className="flex items-center justify-between gap-3 border border-line-2 px-3.5 py-2.5 text-sm"
        style={{ borderRadius: radius }}
      >
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="truncate font-medium hover:underline"
          style={{ color: accent }}
        >
          {file.name}
        </a>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="flex-none text-faint hover:text-ink"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );

  return (
    <label
      className="flex cursor-pointer flex-col items-center gap-1.5 border border-dashed border-line-2 py-5 text-sm text-muted transition-colors hover:border-ink"
      style={{ borderRadius: radius }}
    >
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {uploading ? "Uploading…" : "Choose a file"}
      <input type="file" className="hidden" onChange={onPick} disabled={uploading} />
      {err && <span className="text-red">{err}</span>}
    </label>
  );
}
