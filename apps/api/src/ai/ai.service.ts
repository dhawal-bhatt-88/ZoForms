import { BadRequestException, Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import {
  FormSchema,
  optionsFromLabels,
  type Block,
  type BlockType,
  type FormSchema as TFormSchema,
} from "@formbuilder/form-schema";
import { env } from "../config/env";

/*
 * Coded options (contract §13): the model is asked for plain option labels. Each
 * becomes { code: "", label }, and the parse generates its code. Out of scope for
 * the coded-options work, so only kept working — see KNOWN-ISSUES.md.
 */
function withCodedOptions(b: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(b.options)) return b;
  return { ...b, options: b.options.map((o) => (typeof o === "string" ? { code: "", label: o } : o)) };
}

@Injectable()
export class AiService {
  /** Generate a form schema from a natural-language prompt. Uses Claude when a
   * key is configured, otherwise a heuristic so the feature works out of the box. */
  async generateSchema(
    prompt: string,
    opts?: { apiKey?: string; model?: string },
  ): Promise<TFormSchema> {
    const p = (prompt || "").trim();
    if (!p) throw new BadRequestException("Describe the form you want to build.");
    const apiKey = opts?.apiKey || env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        return await this.viaClaude(p, apiKey, opts?.model);
      } catch {
        /* fall back to heuristic on any API failure */
      }
    }
    return this.heuristic(p);
  }

  private async viaClaude(
    prompt: string,
    apiKey: string,
    model?: string,
  ): Promise<TFormSchema> {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: model || env.ANTHROPIC_MODEL,
      max_tokens: 1500,
      tools: [
        {
          name: "create_form",
          description: "Create a form matching the user's request.",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              blocks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: [
                        "short", "long", "choice", "checkbox", "dropdown",
                        "number", "email", "phone", "date", "rating", "file", "heading",
                      ],
                    },
                    label: { type: "string" },
                    required: { type: "boolean" },
                    options: { type: "array", items: { type: "string" } },
                  },
                  required: ["type", "label"],
                },
              },
            },
            required: ["title", "blocks"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "create_form" },
      messages: [
        {
          role: "user",
          content: `Create a concise, well-structured form (3-7 questions) for this request: ${prompt}`,
        },
      ],
    });
    const tool = msg.content.find((c) => c.type === "tool_use") as
      | { input?: { title: string; description?: string; blocks: Array<Record<string, unknown>> } }
      | undefined;
    const raw = tool?.input;
    if (!raw) throw new Error("No tool output");
    const withIds = {
      ...raw,
      blocks: (raw.blocks || []).map((b, i) => ({ id: "b_" + i, required: false, ...withCodedOptions(b) })),
    };
    return FormSchema.parse(withIds);
  }

  private heuristic(prompt: string): TFormSchema {
    const p = prompt.toLowerCase();
    const blocks: Block[] = [];
    const add = (type: BlockType, label: string, required = false, options?: string[]) =>
      blocks.push({
        id: "b_" + blocks.length,
        type,
        label,
        required,
        ...(options ? { options: optionsFromLabels(...options) } : {}),
      } as Block);
    const has = (re: RegExp) => re.test(p);

    const isFeedback = has(/feedback|survey|satisfaction|rate|rating|review|nps|experience/);
    const isJob = has(/job|application|apply|candidate|resume|cv|hiring|recruit/);
    const isEvent = has(/rsvp|event|invite|registration|register|attend|webinar|workshop/);
    const isBug = has(/bug|issue|report a|problem|support ticket/);
    const isContact = has(/contact|reach|get in touch|inquiry|enquiry/);

    add("short", isJob ? "Full name" : "Your name", true);
    add("email", "Email", true);
    if (has(/phone|call|mobile/) || isJob) add("phone", "Phone number", isJob);
    if (has(/company|business|organi[sz]ation|employer/)) add("short", "Company");

    if (isFeedback) {
      add("rating", "How would you rate your experience?", true);
      add("long", "What could we do better?");
      add("choice", "Would you recommend us?", false, ["Definitely", "Maybe", "Not yet"]);
    } else if (isJob) {
      add("file", "Résumé", true);
      add("long", "Why do you want this role?", true);
    } else if (isEvent) {
      add("choice", "Will you attend?", true, ["Yes", "No", "Maybe"]);
      add("number", "Number of guests");
      add("date", "Preferred date");
    } else if (isBug) {
      add("long", "Steps to reproduce", true);
      add("dropdown", "Severity", true, ["Low", "Medium", "High", "Critical"]);
      add("file", "Screenshot");
    } else {
      if (has(/date|when|schedule|appointment|booking/)) add("date", "Preferred date");
      if (has(/file|upload|attach|document|photo|image/)) add("file", "Attachment");
      if (has(/budget|amount|price|quantity|how many/)) add("number", "Amount");
      add("long", isContact ? "How can we help?" : "Your message", true);
    }

    const title = isFeedback
      ? "Feedback survey"
      : isJob
        ? "Job application"
        : isEvent
          ? "Event RSVP"
          : isBug
            ? "Bug report"
            : isContact
              ? "Contact form"
              : (() => {
                  const t = prompt.trim().replace(/^(create |make |build |generate |a |an )+/i, "");
                  return t ? t.charAt(0).toUpperCase() + t.slice(1, 48) : "New form";
                })();

    return { title, description: `Drafted from: “${prompt.slice(0, 90)}”`, blocks };
  }

  /* ---------- conversational edit ("Ask AI") ---------- */

  async editSchema(
    current: unknown,
    instruction: string,
    opts?: { apiKey?: string; model?: string },
  ): Promise<{ schema: TFormSchema; message: string; changes: string[] }> {
    const parsed = FormSchema.parse(current);
    const inst = (instruction || "").trim();
    if (!inst) throw new BadRequestException("Tell the assistant what to change.");
    const apiKey = opts?.apiKey || env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        return await this.editViaClaude(parsed, inst, apiKey, opts?.model);
      } catch {
        /* fall back to heuristic */
      }
    }
    return this.editHeuristic(parsed, inst);
  }

  private async editViaClaude(
    current: TFormSchema,
    instruction: string,
    apiKey: string,
    model?: string,
  ): Promise<{ schema: TFormSchema; message: string; changes: string[] }> {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: model || env.ANTHROPIC_MODEL,
      max_tokens: 2200,
      tools: [
        {
          name: "update_form",
          description: "Return the FULL updated form after applying the user's edit.",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              blocks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: [
                        "short", "long", "choice", "checkbox", "dropdown",
                        "number", "email", "phone", "date", "rating", "file", "heading",
                      ],
                    },
                    label: { type: "string" },
                    required: { type: "boolean" },
                    options: { type: "array", items: { type: "string" } },
                    description: { type: "string" },
                  },
                  required: ["type", "label"],
                },
              },
              message: {
                type: "string",
                description: "A short, friendly reply to the user (1-2 sentences).",
              },
              changes: {
                type: "array",
                items: { type: "string" },
                description: "Short summaries of each change, e.g. 'Added phone field'.",
              },
            },
            required: ["blocks", "message", "changes"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "update_form" },
      messages: [
        {
          role: "user",
          content:
            `Current form (JSON):\n${JSON.stringify({
              title: current.title,
              description: current.description,
              blocks: current.blocks,
            })}\n\nApply this instruction and return the complete updated form: ${instruction}`,
        },
      ],
    });
    const tool = msg.content.find((c) => c.type === "tool_use") as
      | { input?: { title?: string; description?: string; blocks: Array<Record<string, unknown>>; message?: string; changes?: string[] } }
      | undefined;
    const raw = tool?.input;
    if (!raw) throw new Error("No tool output");
    const blocks = (raw.blocks || []).map((b, i) => ({ id: "b_" + i, required: false, ...withCodedOptions(b) }));
    const schema = FormSchema.parse({
      title: raw.title || current.title,
      description: raw.description ?? current.description,
      blocks,
      settings: current.settings,
    });
    return {
      schema,
      message: raw.message || "Done.",
      changes: Array.isArray(raw.changes) ? raw.changes : [],
    };
  }

  private editHeuristic(
    current: TFormSchema,
    instruction: string,
  ): { schema: TFormSchema; message: string; changes: string[] } {
    const p = instruction.toLowerCase();
    const blocks = [...current.blocks];
    const changes: string[] = [];
    const typeMap: Array<[RegExp, BlockType, string]> = [
      [/phone|mobile/, "phone", "Phone number"],
      [/e-?mail/, "email", "Email"],
      [/rating|rate|stars?/, "rating", "How would you rate this?"],
      [/address/, "short", "Address"],
      [/company|organi[sz]ation|employer/, "short", "Company"],
      [/date|day|schedule|when/, "date", "Date"],
      [/number|quantity|amount|age/, "number", "Number"],
      [/file|upload|attachment|resume|cv/, "file", "Attachment"],
      [/comment|message|feedback|note|long|paragraph/, "long", "Your message"],
      [/name/, "short", "Your name"],
    ];

    if (/\b(add|include|insert|append|need|put)\b/.test(p)) {
      let matched: [BlockType, string] | null = null;
      for (const [re, type, label] of typeMap) {
        if (re.test(p)) {
          matched = [type, label];
          break;
        }
      }
      const [type, label] = matched || (["short", "New question"] as [BlockType, string]);
      blocks.push({ id: "b_" + Date.now().toString(36), type, label, required: false } as Block);
      changes.push(`Added ${label}`);
    } else if (/\b(remove|delete|drop|get rid)\b/.test(p)) {
      const kw = p.replace(/.*\b(remove|delete|drop|get rid of)\b/, "").trim().split(/\s+/)[0] || "";
      const before = blocks.length;
      const kept = blocks.filter((b) => !(kw && b.label.toLowerCase().includes(kw)));
      if (kept.length < before) {
        changes.push(`Removed ${before - kept.length} field(s)`);
        blocks.length = 0;
        blocks.push(...kept);
      }
    } else if (/required|optional/.test(p)) {
      const makeOptional = /optional|not required|no longer/.test(p);
      blocks.forEach((b) => {
        (b as { required?: boolean }).required = !makeOptional;
      });
      changes.push(makeOptional ? "Made all fields optional" : "Made all fields required");
    }

    const message = changes.length
      ? `Done — ${changes.join(", ").toLowerCase()}. Add a Claude API key in Settings for richer edits.`
      : "I can add/remove fields and toggle required without a key. Try “add a phone field”, “remove company”, or add your Claude key in Settings for anything more.";
    const schema = FormSchema.parse({ ...current, blocks });
    return { schema, message, changes };
  }

  /* ==================== AI copilot features ==================== */

  /** Suggest conditional-logic / branching rules for a form. */
  async suggestLogic(
    rawSchema: unknown,
    opts?: { apiKey?: string; model?: string },
  ): Promise<{ suggestions: { when: string; then: string; rationale?: string }[]; ai: boolean }> {
    const schema = FormSchema.parse(rawSchema);
    const apiKey = opts?.apiKey || env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const digest = schema.blocks
          .map((b, i) => `${i + 1}. [${b.type}] ${b.label}${b.options ? ` (${b.options.map((o) => o.label).join(", ")})` : ""}`)
          .join("\n");
        const text = await this.claudeText(
          apiKey,
          opts?.model,
          `You are a form-logic assistant. Given these form questions, suggest up to 6 useful conditional-logic rules (show/hide/jump/skip). Reply ONLY with a JSON array of objects {"when","then","rationale"}.\n\nQuestions:\n${digest}`,
          900,
        );
        const parsed = JSON.parse(this.extractJson(text));
        if (Array.isArray(parsed)) {
          return { suggestions: parsed.slice(0, 8), ai: true };
        }
      } catch {
        /* fall back */
      }
    }
    return { suggestions: this.logicHeuristic(schema), ai: false };
  }

  /** Summarize a form's responses into themes + a short narrative. */
  async summarizeResponses(
    rawSchema: unknown,
    responses: { data: unknown }[],
    opts?: { apiKey?: string; model?: string },
  ): Promise<{ summary: string; ai: boolean }> {
    const schema = FormSchema.parse(rawSchema);
    if (!responses.length) return { summary: "No responses to summarize yet.", ai: false };
    const apiKey = opts?.apiKey || env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const summary = await this.claudeText(
          apiKey,
          opts?.model,
          `Summarize the key themes, sentiment and notable outliers across these ${responses.length} form responses in 4-6 sentences.\n\n${this.responsesDigest(schema, responses, 60)}`,
          700,
        );
        if (summary.trim()) return { summary: summary.trim(), ai: true };
      } catch {
        /* fall back */
      }
    }
    return { summary: this.summaryHeuristic(schema, responses), ai: false };
  }

  /** Answer a natural-language question about a form's responses. */
  async answerCopilot(
    rawSchema: unknown,
    responses: { data: unknown }[],
    question: string,
    opts?: { apiKey?: string; model?: string },
  ): Promise<{ answer: string; ai: boolean }> {
    const schema = FormSchema.parse(rawSchema);
    const q = (question || "").trim();
    if (!q) throw new BadRequestException("Ask a question about your responses.");
    if (!responses.length) return { answer: "There are no responses yet.", ai: false };
    const apiKey = opts?.apiKey || env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const answer = await this.claudeText(
          apiKey,
          opts?.model,
          `Answer the question using ONLY these ${responses.length} form responses. Be concise and cite counts where relevant.\n\nQuestion: ${q}\n\n${this.responsesDigest(schema, responses, 80)}`,
          600,
        );
        if (answer.trim()) return { answer: answer.trim(), ai: true };
      } catch {
        /* fall back */
      }
    }
    return { answer: this.copilotHeuristic(schema, responses, q), ai: false };
  }

  /** Translate a form's copy into another language. */
  async translateForm(
    rawSchema: unknown,
    targetLang: string,
    opts?: { apiKey?: string; model?: string },
  ): Promise<{ schema: TFormSchema; translated: boolean; note?: string }> {
    const schema = FormSchema.parse(rawSchema);
    const lang = (targetLang || "").trim();
    if (!lang) throw new BadRequestException("Choose a target language.");
    const apiKey = opts?.apiKey || env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        schema,
        translated: false,
        note: "Add a Claude API key in Settings to enable auto-translation.",
      };
    }
    try {
      const text = await this.claudeText(
        apiKey,
        opts?.model,
        `Translate every user-facing string (title, description, each block's label/description/placeholder/options, and settings.submitLabel) in this form JSON into ${lang}. Keep all ids, types and structure IDENTICAL. Reply ONLY with the translated JSON.\n\n${JSON.stringify(schema)}`,
        2000,
      );
      const parsed = FormSchema.parse(JSON.parse(this.extractJson(text)));
      return { schema: parsed, translated: true };
    } catch {
      return { schema, translated: false, note: `Couldn't translate to ${lang}. Please try again.` };
    }
  }

  /* ---------- shared helpers ---------- */

  private async claudeText(
    apiKey: string,
    model: string | undefined,
    prompt: string,
    maxTokens = 800,
  ): Promise<string> {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: model || env.ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    const t = msg.content.find((c) => c.type === "text");
    return (t as { text?: string } | undefined)?.text ?? "";
  }

  private extractJson(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    const start = text.search(/[[{]/);
    const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
    return start >= 0 && end > start ? text.slice(start, end + 1) : text;
  }

  private responsesDigest(
    schema: TFormSchema,
    responses: { data: unknown }[],
    limit: number,
  ): string {
    const labels = new Map(schema.blocks.map((b) => [b.id, b.label]));
    return responses
      .slice(0, limit)
      .map((r, i) => {
        const parts = Object.entries(r.data as Record<string, unknown>).map(
          ([k, v]) => `${labels.get(k) ?? k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`,
        );
        return `#${i + 1} — ${parts.join(" | ")}`;
      })
      .join("\n");
  }

  private logicHeuristic(schema: TFormSchema): { when: string; then: string; rationale?: string }[] {
    const out: { when: string; then: string; rationale?: string }[] = [];
    const choices = schema.blocks.filter(
      (b) => b.options && b.options.length && ["choice", "dropdown", "checkbox", "multiselect"].includes(b.type),
    );
    for (const b of choices.slice(0, 5)) {
      const opt = b.options![0];
      out.push({
        when: `“${b.label}” is “${opt.label}”`,
        then: "show a relevant follow-up question",
        rationale: "Branch on the most common answer to ask targeted follow-ups.",
      });
    }
    if (!out.length) {
      out.push({
        when: "a respondent selects a specific option",
        then: "jump to the matching section",
        rationale: "Add multiple-choice questions to unlock branching.",
      });
    }
    return out;
  }

  private summaryHeuristic(
    schema: TFormSchema,
    responses: { data: unknown }[],
  ): string {
    const lines = [`${responses.length} response${responses.length === 1 ? "" : "s"} collected.`];
    for (const b of schema.blocks) {
      if (!b.options || !b.options.length) continue;
      const counts: Record<string, number> = {};
      for (const r of responses) {
        const v = (r.data as Record<string, unknown>)[b.id];
        for (const val of Array.isArray(v) ? v : [v]) {
          if (val == null || val === "") continue;
          counts[String(val)] = (counts[String(val)] ?? 0) + 1;
        }
      }
      const top = Object.entries(counts).sort((a, b2) => b2[1] - a[1])[0];
      if (top) lines.push(`Most common “${b.label}”: ${top[0]} (${top[1]}).`);
    }
    lines.push("Add a Claude API key in Settings for a richer narrative summary.");
    return lines.join(" ");
  }

  private copilotHeuristic(
    schema: TFormSchema,
    responses: { data: unknown }[],
    question: string,
  ): string {
    const q = question.toLowerCase();
    if (/how many|count|number of/.test(q)) {
      return `There are ${responses.length} responses. Connect a Claude API key in Settings for detailed answers.`;
    }
    // Try to match a question label and report its most common value.
    const block = schema.blocks.find((b) => q.includes(b.label.toLowerCase()));
    if (block) {
      const counts: Record<string, number> = {};
      for (const r of responses) {
        const v = (r.data as Record<string, unknown>)[block.id];
        if (v != null && v !== "") counts[String(v)] = (counts[String(v)] ?? 0) + 1;
      }
      const top = Object.entries(counts).sort((a, b2) => b2[1] - a[1])[0];
      if (top) return `Most answers for “${block.label}” were “${top[0]}” (${top[1]} of ${responses.length}).`;
    }
    return `I found ${responses.length} responses. Add a Claude API key in Settings for full copilot answers.`;
  }
}
