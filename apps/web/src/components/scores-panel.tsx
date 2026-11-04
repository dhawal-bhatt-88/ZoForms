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
import { Button, controlClasses, Select } from "@/components/ui";

const FORMULA_HINT = "Use question names, numbers, + - * / and brackets, e.g. q1 + q2";
/** How long after the author stops typing a formula is checked (as the logic field, contract §15.6). */
const FORMULA_CHECK_DELAY_MS = 500;


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
    <div className="mb-4 border-t border-rule pt-3">
      <h3 className="eyebrow mb-1.5 text-graphite-soft">Scores</h3>
      {!scores.length && (
        <p className="mb-2 text-[0.75rem] text-graphite">
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
      <Button ref={addButton} variant="ghost" size="sm" onClick={add} className="-ml-2.5 mt-1.5">
        <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add score
      </Button>
      {scores.length > 0 && (
        <details className="mt-2 text-[0.75rem] text-graphite">
          <summary className="cursor-pointer select-none text-ink">Question names ({questions.length})</summary>
          {questions.length ? (
            <ul className="mt-1.5 flex flex-col gap-1">
              {questions.map(({ block, name }) => (
                <li key={block.id} className="flex min-w-0 items-baseline gap-2">
                  <code className="flex-none rounded bg-paper-sunk px-1 font-mono text-[0.75rem] text-ink">{name ?? "—"}</code>
                  <span className="min-w-0 truncate" title={blockName(block)}>
                    {blockName(block)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5">
              No questions this group can score yet. Add number, scale, rating, choice, dropdown, checkbox or
              matrix questions to it.
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
    <fieldset className="min-w-0 rounded-lg border border-rule bg-paper-sunk p-2.5">
      <legend className="sr-only">Score {n}</legend>
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span aria-hidden className="eyebrow text-graphite-soft">
          Score {n}
        </span>
        <Button variant="ghost" size="icon" onClick={onRemove} className="text-graphite hover:text-ink" aria-label={`Remove ${named}`}>
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>

      <label htmlFor={`${base}-label`} className="mb-1 block text-[0.75rem] font-medium text-ink">
        Label
      </label>
      <input
        id={`${base}-label`}
        value={score.label}
        onChange={(e) => onChange({ ...score, label: e.target.value })}
        aria-invalid={labelError ? true : undefined}
        aria-describedby={labelError ? `${base}-label-error` : undefined}
        className={controlClasses({ size: "sm", invalid: !!labelError })}
      />
      {labelError && (
        <p id={`${base}-label-error`} role="alert" data-field-error className="mt-1 flex items-start gap-1 text-[0.75rem] text-fail">
          <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
          {labelError}
        </p>
      )}

      <label htmlFor={`${base}-formula`} className="mb-1 mt-2.5 block text-[0.75rem] font-medium text-ink">
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
        className={controlClasses({
          size: "sm",
          mono: true,
          invalid: !!formulaError,
          className: "block max-h-48 min-h-[3.25rem] resize-y overflow-y-auto break-words [field-sizing:content] [overflow-wrap:anywhere]",
        })}
      />
      <p id={`${base}-formula-hint`} className="mt-1 text-[0.75rem] text-graphite">
        {FORMULA_HINT}
      </p>
      <div id={`${base}-formula-error`} aria-live="polite">
        {formulaError && (
          <p data-field-error className="mt-1 flex items-start gap-1 text-[0.75rem] text-fail">
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
              <li key={p.blockId} data-field-error className="flex flex-col items-start gap-1 text-[0.75rem] text-fail">
                <span className="flex items-start gap-1">
                  <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
                  <span>
                    {question ? `"${blockName(question)}": ` : ""}
                    {p.detail}
                  </span>
                </span>
                {question && (
                  <Button size="sm" onClick={() => onJump(p.blockId)} className="ml-[18px] block max-w-[calc(100%-18px)] truncate">
                    {blockName(question)} →
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <fieldset className="mt-2.5 min-w-0">
        <legend className="mb-1 text-[0.75rem] font-medium text-ink">If a question is unanswered</legend>
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
                className="h-4 w-4 accent-brand-deep"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <label htmlFor={`${base}-decimals`} className="text-[0.75rem] font-medium text-ink">
          Decimal places
        </label>
        <Select
          size="sm"
          id={`${base}-decimals`}
          value={score.decimals ?? 0}
          onChange={(e) => {
            const decimals = Number(e.target.value);
            onChange({ ...score, decimals: decimals === 0 ? undefined : decimals });
          }}
          wrapperClassName="w-auto"
          className="w-[4.5rem]"
        >
          {[0, 1, 2, 3, 4].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[0.8125rem]">
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
