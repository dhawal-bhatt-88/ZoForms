import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { sameStoredContent, seedSystemTemplates } from "./system-templates";

type Row = { id: string; orgId: string | null; kind: string; name: string; description: string | null; content: unknown; version: number };

/** Just the template calls the seeder makes, over an in-memory table. */
function fakePrisma(rows: Row[]) {
  const table = new Map(rows.map((r) => [r.id, { ...r }]));
  const template = {
    findUnique: async ({ where }: { where: { id: string } }) => table.get(where.id) ?? null,
    upsert: async ({ where, create }: { where: { id: string }; create: Row }) => {
      if (!table.has(where.id)) table.set(where.id, { ...create });
      return table.get(where.id);
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = { ...table.get(where.id)!, ...data };
      table.set(where.id, row);
      return row;
    },
    deleteMany: async () => ({ count: 0 }),
  };
  return { prisma: { template } as unknown as PrismaClient, table };
}

const content = {
  title: "How are we doing?",
  blocks: [{ id: "nps", type: "scale", label: "How likely are you to recommend us?", required: true, min: 0, max: 10 }],
};
const file = { id: "sys_form_test", kind: "form", name: "Test", content };
const row = (stored: unknown): Row => ({ id: file.id, orgId: null, kind: "form", name: "Test", description: null, content: stored, version: 1 });

describe("seedSystemTemplates", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "system-templates-"));
    writeFileSync(join(dir, "form-test.json"), JSON.stringify(file));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("rewrites a row that differs from its file only by a key the schema now drops", async () => {
    const { prisma, table } = fakePrisma([row({ ...content, settings: { submitLabel: "Send" } })]);
    const result = await seedSystemTemplates(prisma, dir);
    expect(result).toMatchObject({ updated: 1, unchanged: 0, skipped: [] });
    expect(table.get(file.id)!.content).toEqual(content);
    expect(table.get(file.id)!.content).not.toHaveProperty("settings");
    expect(table.get(file.id)!.version).toBe(2);
  });

  it("leaves a row alone when only its key order differs, as Postgres jsonb returns it", async () => {
    const reordered = { blocks: [{ max: 10, min: 0, required: true, label: content.blocks[0].label, type: "scale", id: "nps" }], title: content.title };
    const { prisma, table } = fakePrisma([row(reordered)]);
    const result = await seedSystemTemplates(prisma, dir);
    expect(result).toMatchObject({ updated: 0, unchanged: 1 });
    expect(table.get(file.id)!.version).toBe(1);
  });
});

describe("sameStoredContent", () => {
  it("ignores key order, at any depth", () => {
    expect(sameStoredContent({ a: 1, b: { c: [1, { d: 2, e: 3 }] } }, { b: { c: [1, { e: 3, d: 2 }] }, a: 1 })).toBe(true);
  });
  it("keeps array order and notices an extra key", () => {
    expect(sameStoredContent({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameStoredContent({ a: 1, settings: {} }, { a: 1 })).toBe(false);
  });
});
