"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, Plus, X } from "lucide-react";
import {
  blockName,
  findBlock,
  formulaTextError,
  newScoreId,
  scoreableQuestions,
  type Block,
  type ConditionProblem,
  type GroupBlock,
  type Score,
  type ScoreUnanswered,
} from "@formbuilder/form-schema";
import { Switch } from "@/components/switch";

const FORMULA_HINT = "Use question names, numbers, + - * / and brackets, e.g. q1 + q2";
/** How long after the author stops typing a formula is checked (as the logic field, contract §15.6). */
const FORMULA_CHECK_DELAY_MS = 500;

const field =
  "w-full rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-weak aria-[invalid=true]:border-red";

/**
 * The group inspector's Scores panel (contract §17.9): the group's scores, each
 * with a label, a formula over the names of the questions it can reach, how
 * an unanswered question counts, decimal places, and whether the respondent
 * sees it after submitting. Formula errors follow the logic field (§15.6):
 * checked after a pause in typing or on leaving the field, shown with a red
 * border, an icon and the message, with `aria-invalid`, `aria-describedby` and
 * a polite live region. A missing option score a formula needs is listed under
 * its score, with a link to the question. The save refuses all of these with
 * the same messages.
 */
export function ScoresPanel({
  group,
  blocks,
  problems,
  onChange,
  onJump,
}: {
  group: GroupBlock;
  blocks: Block[];
  /** The save's problems for this group's scores (`scoreProblems`), including missing option scores. */
  problems: readonly ConditionProblem[];
  /** The group's new scores; an empty list removes them. */
  onChange: (scores: Score[] | undefined) => void;
  onJump: (blockId: string) => void;
}) {
  const scores = group.scores ?? [];
  const addButton = useRef<HTMLButtonElement>(null);
  const questions = scoreableQuestions(blocks, group.id);

  function add() {
    const taken = scores.flatMap((s) => (s.id ? [s.id] : []));
    const labels = new Set(scores.map((s) => s.label.trim().toLowerCase()));
    let label = "Total score";
    for (let n = scores.length + 1; labels.has(label.toLowerCase()); n += 1) label = `Score ${n}`;
    onChange([...scores, { id: newScoreId(taken), label, formulaText: "", unanswered: "no-score" }]);
  }

  return (
    <div className="mb-4 border-t border-line pt-3">
      <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">Scores</h4>
      {!scores.length && (
        <p className="mb-2 text-xs text-muted">
          Calculate a score from this group&apos;s answers, such as a questionnaire total.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {scores.map((s, i) => (
          <ScoreEditor
            key={s.id ?? i}
            index={i}
            score={s}
            group={group}
            blocks={blocks}
            problems={problems.filter((p) => p.score === (s.id ?? i))}
            onChange={(next) => onChange(scores.map((x, k) => (k === i ? next : x)))}
            onRemove={() => {
              const next = scores.filter((_, k) => k !== i);
              onChange(next.length ? next : undefined);
              addButton.current?.focus();
            }}
            onJump={onJump}
          />
        ))}
      </div>
      <button
        ref={addButton}
        type="button"
        onClick={add}
        className="mt-2 flex items-center gap-1.5 text-sm font-medium text-accent-2 hover:underline"
      >
        <Plus className="h-4 w-4" /> Add score
      </button>
      {scores.length > 0 && (
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer select-none text-ink-2">Question names ({questions.length})</summary>
          {questions.length ? (
            <ul className="mt-1.5 flex flex-col gap-1">
              {questions.map(({ block, name }) => (
                <li key={block.id} className="flex min-w-0 items-baseline gap-2">
                  <code className="flex-none rounded bg-surface-3 px-1 font-mono text-[12px] text-ink">{name ?? "—"}</code>
                  <span className="min-w-0 truncate" title={blockName(block)}>
                    {blockName(block)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5">
              No questions this group can score yet. Add number, scale, rating, choice, dropdown, checkbox,
              multiselect or matrix questions to it.
            </p>
          )}
        </details>
      )}
    </div>
  );
}

function ScoreEditor({
  index,
  score,
  group,
  blocks,
  problems,
  onChange,
  onRemove,
  onJump,
}: {
  index: number;
  score: Score;
  group: GroupBlock;
  blocks: Block[];
  problems: readonly ConditionProblem[];
  onChange: (score: Score) => void;
  onRemove: () => void;
  onJump: (blockId: string) => void;
}) {
  const n = index + 1;
  const base = `score-${group.id}-${score.id ?? index}`;
  const text = score.formulaText ?? "";
  const named = score.label.trim() ? `score "${score.label.trim()}"` : `score ${n}`;

  // The formula is checked once the author pauses typing or leaves the field
  // (contract §15.6). `checked` is the text as it was then; a change made any
  // other way (a rename rewriting it, Cancel, a save) is checked at once.
  const [checked, setChecked] = useState(text);
  const typed = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (text !== typed.current) {
      typed.current = text;
      setChecked(text);
    }
  }, [text]);
  const formulaError = formulaTextError(blocks, group.id, checked);
  const labelError = score.label.trim() ? null : "It needs a label.";
  // Questions the formula uses that are missing an option score (contract §17.6): problems on those questions.
  const missing = problems.filter((p) => p.blockId !== group.id);

  function typeFormula(value: string) {
    typed.current = value;
    onChange({ ...score, formulaText: value });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setChecked(value), FORMULA_CHECK_DELAY_MS);
  }

  return (
    <fieldset className="min-w-0 rounded-lg border border-line bg-surface-2 p-2.5">
      <legend className="sr-only">Score {n}</legend>
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span aria-hidden className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Score {n}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="grid h-7 w-7 flex-none place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink"
          aria-label={`Remove ${named}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label htmlFor={`${base}-label`} className="mb-1 block text-xs font-semibold text-ink-2">
        Label
      </label>
      <input
        id={`${base}-label`}
        value={score.label}
        onChange={(e) => onChange({ ...score, label: e.target.value })}
        aria-invalid={labelError ? true : undefined}
        aria-describedby={labelError ? `${base}-label-error` : undefined}
        className={field}
      />
      {labelError && (
        <p id={`${base}-label-error`} role="alert" className="mt-1 flex items-start gap-1 text-xs text-red">
          <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
          {labelError}
        </p>
      )}

      <label htmlFor={`${base}-formula`} className="mb-1 mt-2.5 block text-xs font-semibold text-ink-2">
        Formula
      </label>
      {/*
        Grows with its text up to about eight lines, then scrolls; long formulas wrap at
        spaces, and a run without spaces wraps anywhere rather than widening the inspector.
      */}
      <textarea
        id={`${base}-formula`}
        value={text}
        rows={2}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-invalid={formulaError ? true : undefined}
        aria-describedby={`${base}-formula-hint ${base}-formula-error`}
        onChange={(e) => typeFormula(e.target.value)}
        onBlur={(e) => {
          clearTimeout(timer.current);
          setChecked(e.target.value);
        }}
        className={`block max-h-48 min-h-[3.25rem] w-full resize-y overflow-y-auto break-words rounded-lg border bg-surface px-2.5 py-1.5 font-mono text-[13px] outline-none [field-sizing:content] [overflow-wrap:anywhere] focus:ring-2 focus:ring-accent-weak ${
          formulaError ? "border-red focus:border-red" : "border-line-2 focus:border-accent"
        }`}
      />
      <p id={`${base}-formula-hint`} className="mt-1 text-xs text-muted">
        {FORMULA_HINT}
      </p>
      <div id={`${base}-formula-error`} aria-live="polite">
        {formulaError && (
          <p className="mt-1 flex items-start gap-1 text-xs text-red">
            <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
            {formulaError}
          </p>
        )}
      </div>

      {missing.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1.5" aria-label={`Missing option scores for ${named}`}>
          {missing.map((p) => {
            const question = findBlock(blocks, p.blockId)?.block;
            return (
              <li key={p.blockId} className="flex flex-col items-start gap-1 text-xs text-red">
                <span className="flex items-start gap-1">
                  <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
                  <span>
                    {question ? `"${blockName(question)}": ` : ""}
                    {p.detail}
                  </span>
                </span>
                {question && (
                  <button
                    type="button"
                    onClick={() => onJump(p.blockId)}
                    className="ml-[18px] max-w-[calc(100%-18px)] truncate rounded-md border border-[#F5C2C2] bg-white px-2 py-0.5 font-medium text-ink-2 hover:border-red"
                  >
                    {blockName(question)} →
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <fieldset className="mt-2.5 min-w-0">
        <legend className="mb-1 text-xs font-semibold text-ink-2">If a question is unanswered</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {(
            [
              ["no-score", "No score"],
              ["zero", "Count as 0"],
            ] as [ScoreUnanswered, string][]
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`${base}-unanswered`}
                value={value}
                checked={score.unanswered === value}
                onChange={() => onChange({ ...score, unanswered: value })}
                className="h-3.5 w-3.5 accent-[#6D5EFA]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <label htmlFor={`${base}-decimals`} className="text-xs font-semibold text-ink-2">
          Decimal places
        </label>
        <select
          id={`${base}-decimals`}
          value={score.decimals ?? 0}
          onChange={(e) => {
            const decimals = Number(e.target.value);
            onChange({ ...score, decimals: decimals === 0 ? undefined : decimals });
          }}
          className="rounded-lg border border-line-2 bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
        >
          {[0, 1, 2, 3, 4].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[13px]">
        <span id={`${base}-show`}>Show to respondent after submit</span>
        <Switch
          checked={!!score.showToRespondent}
          aria-labelledby={`${base}-show`}
          onChange={(on) => onChange({ ...score, showToRespondent: on ? true : undefined })}
        />
      </div>
    </fieldset>
  );
}
