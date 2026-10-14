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

type SystemTemplateFile = {
  file: string;
  id: string;
  kind: TemplateKind;
  name: string;
  description: string | null;
  content: unknown;
};

/** A file that wasn't loaded, and why. `id` is its id when that could be read, so its template is kept. */
export type SkippedFile = { file: string; id?: string; reason: string };

/** One file read and checked: the template, or why it can't be loaded. */
function readFile(dir: string, file: string): { template: SystemTemplateFile } | { skipped: SkippedFile } {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch (e) {
    return { skipped: { file, reason: `it isn't valid JSON (${(e as Error).message}).` } };
  }
  const t = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  if (typeof t.id !== "string" || !SYSTEM_ID.test(t.id)) {
    return { skipped: { file, reason: '"id" must be "sys_" and lower-case letters, digits or "_".' } };
  }
  const id = t.id;
  const skip = (reason: string) => ({ skipped: { file, id, reason } });
  const kind = TemplateKind.safeParse(t.kind);
  if (!kind.success) return skip('"kind" must be "form" or "group".');
  if (typeof t.name !== "string" || !t.name.trim()) return skip('"name" is required.');
  if (t.description !== undefined && typeof t.description !== "string") return skip('"description" must be text.');
  try {
    const content = prepareTemplateContent(kind.data, t.content);
    return {
      template: { file, id, kind: kind.data, name: t.name.trim(), description: (t.description as string | undefined)?.trim() || null, content },
    };
  } catch (e) {
    const message = e instanceof HttpException ? (e.getResponse() as { message?: unknown }).message : undefined;
    return skip(String(message ?? (e as Error).message));
  }
}

/**
 * Load every system template from `dir`. Idempotent, keyed by each file's id:
 * running it again updates in place and never duplicates. `version` goes up
 * only when the content changed.
 *
 * Every file is checked on its own, as an author's save would be. A file that
 * fails is skipped — reported in `skipped` and to `onSkip`, naming it — and the
 * rest still load; a template loaded from it before stays as it was. A system
 * template whose file is gone is deleted (forms made from it keep their
 * copies), except in a run where some file's id couldn't be read: that file
 * may be the one it came from, so nothing is deleted.
 */
export async function seedSystemTemplates(
  prisma: PrismaClient,
  dir = SYSTEM_TEMPLATES_DIR,
  onSkip: (skipped: SkippedFile) => void = () => {},
) {
  const skipped: SkippedFile[] = [];
  const skip = (s: SkippedFile) => {
    skipped.push(s);
    onSkip(s);
  };
  // Every id a file names, loaded or not: those templates are never deleted.
  const named = new Set<string>();
  const templates: SystemTemplateFile[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const read = readFile(dir, file);
    if ("skipped" in read) {
      if (read.skipped.id) named.add(read.skipped.id);
      skip(read.skipped);
    } else if (named.has(read.template.id)) {
      skip({ file, id: read.template.id, reason: `another file already uses the id "${read.template.id}".` });
    } else {
      named.add(read.template.id);
      templates.push(read.template);
    }
  }

  const counts = { created: 0, updated: 0, unchanged: 0, removed: 0 };
  for (const t of templates) {
    const content = t.content as Prisma.InputJsonValue;
    const existing = await prisma.template.findUnique({ where: { id: t.id } });
    if (existing && existing.orgId !== null) {
      skip({ file: t.file, id: t.id, reason: `the id "${t.id}" is already used by an organisation's template.` });
      continue;
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
  if (!skipped.some((s) => s.id === undefined)) {
    const removed = await prisma.template.deleteMany({ where: { orgId: null, id: { notIn: [...named] } } });
    counts.removed = removed.count;
  }
  return { ...counts, skipped };
}
