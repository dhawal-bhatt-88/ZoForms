import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { HttpException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";
import { TemplateKind } from "@formbuilder/form-schema";
import { prepareTemplateContent, sameTemplateContent } from "./template-content";

/**
 * System templates are made by us, one JSON file each:
 * `{ "id": "sys_…", "kind": "form" | "group", "name", "description"?, "content" }`.
 * There is no UI for authoring them: build one as an organisation template,
 * export its content, and add the file.
 */
export const SYSTEM_TEMPLATES_DIR = join(__dirname, "..", "..", "prisma", "templates");

const SYSTEM_ID = /^sys_[a-z0-9_]{1,60}$/;

type SystemTemplateFile = { id: string; kind: TemplateKind; name: string; description: string | null; content: unknown };

function readFile(dir: string, file: string): SystemTemplateFile {
  const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>;
  const fail = (why: string): never => {
    throw new Error(`System template ${file}: ${why}`);
  };
  if (typeof raw.id !== "string" || !SYSTEM_ID.test(raw.id)) fail('"id" must be "sys_" and lower-case letters, digits or "_".');
  const kind = TemplateKind.safeParse(raw.kind);
  if (!kind.success) fail('"kind" must be "form" or "group".');
  if (typeof raw.name !== "string" || !raw.name.trim()) fail('"name" is required.');
  if (raw.description !== undefined && typeof raw.description !== "string") fail('"description" must be text.');
  let content: unknown;
  try {
    content = prepareTemplateContent(kind.data!, raw.content);
  } catch (e) {
    fail(e instanceof HttpException ? String((e.getResponse() as { message?: unknown }).message ?? e.message) : (e as Error).message);
  }
  return {
    id: raw.id as string,
    kind: kind.data!,
    name: (raw.name as string).trim(),
    description: (raw.description as string | undefined)?.trim() || null,
    content,
  };
}

/**
 * Load every system template from `dir`. Idempotent, keyed by each file's id:
 * running it again updates in place and never duplicates. `version` goes up
 * only when the content changed. A system template whose file is gone is
 * deleted (forms made from it keep their copies). Every file is checked as an
 * author's save would be; a bad file throws, naming it, before anything is
 * written.
 */
export async function seedSystemTemplates(prisma: PrismaClient, dir = SYSTEM_TEMPLATES_DIR) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const templates = files.map((file) => readFile(dir, file));
  const seen = new Set<string>();
  for (const t of templates) {
    if (seen.has(t.id)) throw new Error(`System template id "${t.id}" is used by more than one file.`);
    seen.add(t.id);
  }

  const counts = { created: 0, updated: 0, unchanged: 0, removed: 0 };
  for (const t of templates) {
    const content = t.content as Prisma.InputJsonValue;
    const existing = await prisma.template.findUnique({ where: { id: t.id } });
    if (existing && existing.orgId !== null) {
      throw new Error(`System template id "${t.id}" is already used by an organisation's template.`);
    }
    if (!existing) {
      // An upsert, so two API instances starting at once can't collide.
      await prisma.template.upsert({
        where: { id: t.id },
        create: { id: t.id, orgId: null, kind: t.kind, name: t.name, description: t.description, content, version: 1 },
        update: {},
      });
      counts.created += 1;
      continue;
    }
    const contentChanged = existing.kind !== t.kind || !sameTemplateContent(t.kind, existing.content, t.content);
    const detailsChanged = existing.name !== t.name || existing.description !== t.description;
    if (!contentChanged && !detailsChanged) {
      counts.unchanged += 1;
      continue;
    }
    await prisma.template.update({
      where: { id: t.id },
      data: {
        name: t.name,
        description: t.description,
        ...(contentChanged ? { kind: t.kind, content, version: existing.version + 1 } : {}),
      },
    });
    counts.updated += 1;
  }
  const removed = await prisma.template.deleteMany({ where: { orgId: null, id: { notIn: [...seen] } } });
  counts.removed = removed.count;
  return counts;
}
