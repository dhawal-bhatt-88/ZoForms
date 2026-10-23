"use client";

import { useId, useState } from "react";
import { cn } from "@formbuilder/ui";
import { buttonClasses } from "@/components/ui";

const REASONS = ["Clear instructions", "Example helped", "Missing information", "Didn't match the product"] as const;

/**
 * "Was this page helpful?" Yes or No, and on No the reasons as toggles.
 * Nothing is sent or stored yet (docs brief, decision 3), and the page says so
 * rather than implying the answer went somewhere.
 */
export function Feedback() {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="surface px-4 py-4 sm:px-5">
      <h2 id={titleId} className="text-[0.875rem] font-semibold text-ink">
        Was this page helpful?
      </h2>
      <div className="mt-3 flex gap-2">
        {(["yes", "no"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={answer === value}
            onClick={() => setAnswer(value)}
            className={buttonClasses({
              size: "sm",
              className: answer === value ? "border-brand-deep bg-accent-wash text-brand-deep" : undefined,
            })}
          >
            {value === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>

      {answer === "no" && (
        <div role="group" aria-label="Tell us more" className="mt-4">
          <p className="text-[0.8125rem] text-ink">Tell us more. Choose any that apply.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REASONS.map((reason) => {
              const on = reasons.includes(reason);
              return (
                <button
                  key={reason}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReasons((r) => (on ? r.filter((x) => x !== reason) : [...r, reason]))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[0.75rem] transition-colors duration-200",
                    on ? "border-brand-deep bg-accent-wash text-brand-deep" : "border-rule-strong bg-surface text-graphite hover:text-ink",
                  )}
                >
                  {reason}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p role="status" className="body-sm mt-3 text-graphite">
        {answer ? "Thank you. We don't record these answers yet." : ""}
      </p>
    </section>
  );
}
