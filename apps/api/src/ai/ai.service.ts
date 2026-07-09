import { BadRequestException, Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import {
  FormSchema,
  type Block,
  type BlockType,
  type FormSchema as TFormSchema,
} from "@formbuilder/form-schema";

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
    const apiKey = opts?.apiKey || process.env.ANTHROPIC_API_KEY;
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
      model: model || process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
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
      blocks: (raw.blocks || []).map((b, i) => ({ id: "b_" + i, required: false, ...b })),
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
        ...(options ? { options } : {}),
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
    const apiKey = opts?.apiKey || process.env.ANTHROPIC_API_KEY;
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
      model: model || process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
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
    const blocks = (raw.blocks || []).map((b, i) => ({ id: "b_" + i, required: false, ...b }));
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
}
