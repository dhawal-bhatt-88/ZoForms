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
  async generateSchema(prompt: string): Promise<TFormSchema> {
    const p = (prompt || "").trim();
    if (!p) throw new BadRequestException("Describe the form you want to build.");
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        return await this.viaClaude(p);
      } catch {
        /* fall back to heuristic on any API failure */
      }
    }
    return this.heuristic(p);
  }

  private async viaClaude(prompt: string): Promise<TFormSchema> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
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
}
