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
  const [embed, setEmbed] = useState(false);

  useEffect(() => {
    setEmbed(new URLSearchParams(window.location.search).get("embed") === "1");
  }, []);

  useEffect(() => {
    getPublicForm(slug)
      .then((f) => {
        setForm(f);
        setState("ready");
      })
      .catch(() => setState("notfound"));
  }, [slug]);

  useEffect(() => {
    if (!embed) return;
    const post = () =>
      window.parent?.postMessage(
        { frameHeight: document.documentElement.scrollHeight, frameSlug: slug },
        "*",
      );
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [embed, slug]);

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
    minHeight: embed ? "auto" : "100vh",
    background: embed ? "transparent" : t.background,
    fontFamily: t.fontFamily,
    color: t.text,
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
          className="w-full max-w-lg border p-10 text-center shadow-soft"
          style={{ borderRadius: t.cardRadius, background: t.surface, borderColor: t.border }}
        >
          <div
            className="mx-auto grid h-12 w-12 place-items-center rounded-full"
            style={{ background: t.accent, color: t.buttonText }}
          >
            <Check className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Thanks — got it!</h1>
          <p className="mt-2" style={{ color: t.mutedText }}>
            Your response to “{form?.title}” was submitted.
          </p>
          <p className="mt-8 text-xs" style={{ color: t.mutedText }}>
            Made with <span className="font-semibold">Frame</span>
          </p>
        </div>
      </div>
    );

  return (
    <div style={page} className={embed ? "p-2" : "px-6 py-10"}>
      <form
        onSubmit={onSubmit}
        className="frame-form mx-auto w-full border p-8 shadow-soft sm:p-10"
        style={{
          borderRadius: t.cardRadius,
          maxWidth: t.maxWidth,
          background: t.surface,
          borderColor: t.border,
        }}
      >
        {t.customCss && <style dangerouslySetInnerHTML={{ __html: t.customCss }} />}
        {t.cover && (
          <div
            className="-mx-8 -mt-8 mb-6 overflow-hidden sm:-mx-10 sm:-mt-10"
            style={{ borderTopLeftRadius: t.cardRadius, borderTopRightRadius: t.cardRadius }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.cover} alt="" className="h-40 w-full object-cover" />
          </div>
        )}
        {t.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.logo}
            alt=""
            className="mb-4 h-14 w-14 rounded-xl border object-cover"
            style={{ borderColor: t.border }}
          />
        )}
        <h1 className="text-[26px] font-bold tracking-tight">{form?.title}</h1>
        {form?.schema.description && (
          <p className="mt-1.5" style={{ color: t.mutedText }}>
            {form.schema.description}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-6">
          {form?.schema.blocks.map((b) => (
            <Field
              key={b.id}
              block={b}
              value={values[b.id]}
              error={errors[b.id]}
              accent={t.accent}
              radius={t.radius}
              border={t.border}
              inputBg={t.inputBg}
              inputBorder={t.inputBorder}
              mutedText={t.mutedText}
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
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: t.accent, color: t.buttonText, borderRadius: t.radius }}
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

function toEmbedUrl(url?: string): string {
  if (!url) return "";
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

function scaleRange(min?: number, max?: number): number[] {
  const lo = typeof min === "number" ? min : 1;
  const hi = typeof max === "number" ? max : 5;
  const out: number[] = [];
  for (let n = lo; n <= hi && out.length < 20; n++) out.push(n);
  return out;
}

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "India", "Germany",
  "France", "Netherlands", "Spain", "Italy", "Brazil", "Mexico", "Japan",
  "Singapore", "United Arab Emirates", "Other",
];

function Field({
  block,
  value,
  error,
  accent,
  radius,
  border,
  inputBg,
  inputBorder,
  mutedText,
  onChange,
}: {
  block: Block;
  value: unknown;
  error?: string;
  accent: string;
  radius: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  mutedText: string;
  onChange: (v: unknown) => void;
}) {
  // ---- layout / display blocks (no answer collected) ----
  if (block.type === "heading") {
    const L = block.level || 2;
    const cls = L === 1 ? "text-2xl" : L === 2 ? "text-lg" : "text-[15px]";
    return <div className={`mt-2 ${cls} font-bold tracking-tight`}>{block.label}</div>;
  }
  if (block.type === "title")
    return <h2 className="text-2xl font-bold tracking-tight">{block.content || block.label}</h2>;
  if (block.type === "text")
    return (
      <p className="text-[15px] leading-relaxed" style={{ color: mutedText }}>
        {block.content}
      </p>
    );
  if (block.type === "label")
    return (
      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: mutedText }}>
        {block.content || block.label}
      </div>
    );
  if (block.type === "divider") return <hr className="my-1" style={{ borderColor: border }} />;
  if (block.type === "image")
    return block.content ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={block.content} alt={block.label} className="w-full" style={{ borderRadius: radius }} />
    ) : null;
  if (block.type === "video") {
    const src = toEmbedUrl(block.content);
    return src ? (
      <div className="overflow-hidden" style={{ borderRadius: radius }}>
        <iframe src={src} className="aspect-video w-full" allowFullScreen title={block.label} />
      </div>
    ) : null;
  }
  if (block.type === "audio")
    return block.content ? <audio controls src={block.content} className="w-full" /> : null;
  if (block.type === "embed") {
    return block.content ? (
      <div className="overflow-hidden" style={{ borderRadius: radius }}>
        <iframe src={block.content} className="h-80 w-full" title={block.label} />
      </div>
    ) : null;
  }
  if (block.type === "hidden") return null;
  if (block.type === "recaptcha")
    return (
      <p className="text-xs" style={{ color: mutedText }}>
        🛡️ Protected by reCAPTCHA
      </p>
    );

  const inputStyle = {
    borderRadius: radius,
    borderColor: error ? "#E5484D" : inputBorder,
    background: inputBg,
    color: "inherit",
  } as React.CSSProperties;
  const inputCls =
    "w-full border px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-current";
  const tint = `${accent}14`;
  const optStyle = (on: boolean) =>
    ({
      borderRadius: radius,
      borderColor: on ? accent : inputBorder,
      background: on ? tint : inputBg,
    }) as React.CSSProperties;

  return (
    <div>
      <label className="mb-2 block font-semibold">
        {block.label}
        {block.required && <span className="ml-0.5 text-red">*</span>}
      </label>
      {block.description && (
        <p className="mb-2 -mt-1 text-sm" style={{ color: mutedText }}>
          {block.description}
        </p>
      )}

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
      ) : block.type === "checkbox" || block.type === "multiselect" ? (
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
      ) : block.type === "scale" ? (
        <div className="flex flex-wrap gap-2">
          {scaleRange(block.min, block.max).map((n) => {
            const on = value === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className="grid h-11 w-11 place-items-center border text-[15px] font-medium transition-colors"
                style={optStyle(on)}
              >
                {n}
              </button>
            );
          })}
        </div>
      ) : block.type === "ranking" ? (
        <div className="flex flex-col gap-2">
          {(block.options ?? []).map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const rank = arr.indexOf(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() =>
                  onChange(rank >= 0 ? arr.filter((x) => x !== o) : [...arr, o])
                }
                className="flex items-center gap-3 border border-line-2 px-3.5 py-2.5 text-left text-[15px] transition-colors hover:border-line"
                style={optStyle(rank >= 0)}
              >
                <span
                  className="grid h-6 w-6 flex-none place-items-center rounded-md text-xs font-semibold"
                  style={{
                    background: rank >= 0 ? accent : "transparent",
                    color: rank >= 0 ? "#fff" : mutedText,
                    border: rank >= 0 ? "none" : `1px solid ${border}`,
                  }}
                >
                  {rank >= 0 ? rank + 1 : ""}
                </span>
                {o}
              </button>
            );
          })}
        </div>
      ) : block.type === "matrix" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th />
                {(block.columns ?? []).map((c) => (
                  <th key={c} className="px-2 pb-2 text-center font-medium" style={{ color: mutedText }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(block.options ?? []).map((r) => {
                const map = (value as Record<string, string>) || {};
                return (
                  <tr key={r} style={{ borderTop: `1px solid ${border}` }}>
                    <td className="py-2 pr-2 font-medium">{r}</td>
                    {(block.columns ?? []).map((c) => (
                      <td key={c} className="py-2 text-center">
                        <input
                          type="radio"
                          name={`${block.id}_${r}`}
                          checked={map[r] === c}
                          onChange={() => onChange({ ...map, [r]: c })}
                          style={{ accentColor: accent }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : block.type === "country" ? (
        <select
          className={inputCls}
          style={inputStyle}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select a country…</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : block.type === "payment" || block.type === "signature" ? (
        <div
          className="border border-dashed px-3.5 py-4 text-center text-sm"
          style={{ borderRadius: radius, borderColor: border, color: mutedText }}
        >
          {block.type === "payment"
            ? "💳 Payment collection — connect Stripe to enable"
            : "✍️ Signature capture — coming soon"}
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
          type={
            block.type === "email"
              ? "email"
              : block.type === "number"
                ? "number"
                : block.type === "date"
                  ? "date"
                  : block.type === "time"
                    ? "time"
                    : block.type === "phone"
                      ? "tel"
                      : block.type === "link"
                        ? "url"
                        : "text"
          }
          className={inputCls}
          style={inputStyle}
          placeholder={block.placeholder || (block.type === "link" ? "https://…" : undefined)}
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
