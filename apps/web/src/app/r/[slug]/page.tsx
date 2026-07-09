"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Loader2, Star } from "lucide-react";
import type { Block } from "@formbuilder/form-schema";
import { getPublicForm, submitResponse, type PublicForm } from "@/lib/api";

type Values = Record<string, unknown>;

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
      setDone(true);
    } catch (err) {
      setErrors({ _form: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading")
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  if (state === "notfound")
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Form not found</h1>
          <p className="mt-2 text-muted">This form doesn&apos;t exist or isn&apos;t published yet.</p>
        </div>
      </div>
    );

  if (done)
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-10 text-center shadow-soft">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-weak text-accent-2">
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
    <div className="min-h-screen px-6 py-10">
      <form
        onSubmit={onSubmit}
        className="mx-auto w-full max-w-xl rounded-2xl border border-line bg-surface p-8 shadow-soft sm:p-10"
      >
        <h1 className="text-[26px] font-bold tracking-tight">{form?.title}</h1>
        {form?.schema.description && (
          <p className="mt-1.5 text-muted">{form.schema.description}</p>
        )}

        <div className="mt-7 flex flex-col gap-6">
          {form?.schema.blocks.map((b) => (
            <Field
              key={b.id}
              block={b}
              value={values[b.id]}
              error={errors[b.id]}
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
          className="btn btn-accent mt-8 h-12 w-full text-[15px]"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Submitting…" : "Submit"}
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
  onChange,
}: {
  block: Block;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  if (block.type === "heading")
    return <h2 className="mt-2 text-lg font-bold tracking-tight">{block.label}</h2>;

  const inputCls = `w-full rounded-lg border px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:ring-2 focus:ring-accent-weak ${
    error ? "border-red" : "border-line-2 focus:border-accent"
  }`;

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
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : block.type === "dropdown" ? (
        <select
          className={inputCls}
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
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[15px] transition-colors ${
                value === o ? "border-accent bg-accent-weak" : "border-line-2 hover:border-line"
              }`}
            >
              <input
                type="radio"
                name={block.id}
                checked={value === o}
                onChange={() => onChange(o)}
                className="accent-accent"
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
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[15px] transition-colors ${
                  on ? "border-accent bg-accent-weak" : "border-line-2 hover:border-line"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    onChange(on ? arr.filter((x) => x !== o) : [...arr, o])
                  }
                  className="accent-accent"
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
              className={`transition-transform hover:scale-110 ${
                (value as number) >= n ? "text-[#e2c14d]" : "text-line-2"
              }`}
            >
              <Star className="h-8 w-8" fill={(value as number) >= n ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      ) : block.type === "file" ? (
        <input
          type="file"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line-2 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium"
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
        />
      ) : (
        <input
          type={block.type === "email" ? "email" : block.type === "number" ? "number" : block.type === "date" ? "date" : block.type === "phone" ? "tel" : "text"}
          className={inputCls}
          placeholder={block.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {error && <p className="mt-1.5 text-sm text-red">{error}</p>}
    </div>
  );
}
