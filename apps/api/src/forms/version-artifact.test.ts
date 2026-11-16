import { describe, expect, it } from "vitest";
import type { AuthUser } from "../auth/current-user.decorator";
import type { PrismaService } from "../prisma/prisma.service";
import type { TemplatesService } from "../templates/templates.service";
import type { RendererCore } from "./renderer-core";
import { DOWNLOADABLE_VERSIONS, FormsService } from "./forms.service";

const user: AuthUser = { sub: "u1", email: "a@example.test", orgId: "o1", workspaceId: "w1", role: "VIEWER" };
const FORM_ID = "00000000-0000-4000-8000-000000000001";
const versionId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const content = (n: number) => ({ title: "PHQ-9", blocks: [{ id: "q", type: "short", label: `Question, as of v${n}`, required: false }] });

type Row = { id: string; formId: string; version: number; schema: unknown; label: string | null; createdAt: Date };

/** A form in organisation o1 with versions 1..count, and the writes made to it. */
function service(count: number, { mountProblem = null as string | null, schemaOf = content as (n: number) => unknown } = {}) {
  const rows: Row[] = Array.from({ length: count }, (_, i) => ({
    id: versionId(i + 1), formId: FORM_ID, version: i + 1, schema: schemaOf(i + 1), label: null, createdAt: new Date(0),
  }));
  const newestFirst = () => [...rows].sort((a, b) => b.version - a.version);
  const writes: string[] = [];
  const refuse = (what: string) => () => { writes.push(what); throw new Error(`${what} must not be called`); };
  const prisma = {
    form: {
      findFirst: async ({ where }: { where: { id: string; workspace: { orgId: string } } }) =>
        where.id === FORM_ID && where.workspace.orgId === "o1" ? { id: FORM_ID, title: "PHQ-9", versions: newestFirst().slice(0, 1) } : null,
      create: refuse("form.create"), update: refuse("form.update"), delete: refuse("form.delete"),
    },
    formVersion: {
      findFirst: async ({ where }: { where: { id: string; formId: string } }) => rows.find((r) => r.id === where.id && r.formId === where.formId) ?? null,
      findMany: async () => newestFirst(),
      count: async ({ where }: { where: { version: { gt: number } } }) => rows.filter((r) => r.version > where.version.gt).length,
      create: refuse("formVersion.create"), update: refuse("formVersion.update"),
    },
  };
  const renderer = { mountProblem: () => mountProblem };
  const forms = new FormsService(prisma as unknown as PrismaService, {} as TemplatesService, renderer as unknown as RendererCore);
  return { forms, writes };
}

/** The refusal's status and body. */
async function refusal(run: Promise<unknown>) {
  const e = await run.then(() => { throw new Error("it wasn't refused"); }, (x) => x);
  return { status: e.getStatus(), ...(typeof e.getResponse() === "object" ? e.getResponse() : {}) } as { status: number; code?: string; message?: string };
}

describe("downloading a saved version", () => {
  it("is offered for the 10 most recent versions: the latest and the nine before it", async () => {
    expect(DOWNLOADABLE_VERSIONS).toBe(10);
    const listed = await service(12).forms.listVersions(user, FORM_ID);
    expect(listed.map((v) => [v.version, v.downloadable])).toEqual([
      [12, true], [11, true], [10, true], [9, true], [8, true], [7, true], [6, true], [5, true], [4, true], [3, true], [2, false], [1, false],
    ]);
  });

  it("gives that version's content, id and number, and writes nothing", async () => {
    const { forms, writes } = service(12);
    const { fileName, artifact } = await forms.getVersionArtifact(user, FORM_ID, versionId(3));
    expect(fileName).toBe("phq-9-v3.json");
    expect(artifact.formId).toBe(FORM_ID);
    expect(artifact.formVersionId).toBe(versionId(3));
    expect(artifact.blocks[0]).toMatchObject({ label: "Question, as of v3" });
    expect(writes).toEqual([]);
  });

  it("gives the latest version the same file as the form's own download", async () => {
    const { forms } = service(4);
    expect(await forms.getVersionArtifact(user, FORM_ID, versionId(4))).toEqual(await forms.getArtifact(user, FORM_ID));
  });

  it("refuses the eleventh most recent version, and any older", async () => {
    const { forms } = service(12);
    for (const n of [2, 1]) {
      expect(await refusal(forms.getVersionArtifact(user, FORM_ID, versionId(n)))).toMatchObject({
        status: 422, code: "VERSION_TOO_OLD", message: "Only the 10 most recent versions can be downloaded.",
      });
    }
  });

  it("is a 404 for a version that isn't this form's, and for another organisation's form", async () => {
    const { forms } = service(3);
    expect(await refusal(forms.getVersionArtifact(user, FORM_ID, versionId(99)))).toMatchObject({ status: 404 });
    expect(await refusal(forms.getVersionArtifact({ ...user, orgId: "o2" }, FORM_ID, versionId(3)))).toMatchObject({ status: 404 });
  });

  it("refuses a version the renderer wouldn't show, naming the problem", async () => {
    const { forms } = service(3, { mountProblem: "Block \"q\" has unknown type \"signature\"." });
    expect(await refusal(forms.getVersionArtifact(user, FORM_ID, versionId(2)))).toMatchObject({
      status: 422, code: "FORM_INVALID", message: "The renderer would refuse this form: Block \"q\" has unknown type \"signature\".",
    });
  });

  it("refuses a version today's format can't read, naming the problem, and doesn't patch it", async () => {
    const old = (n: number) => (n === 1 ? { title: "PHQ-9", blocks: [{ id: "q", type: "choice", label: "Mood", required: false, options: ["Low", "High"] }] } : content(n));
    const { forms, writes } = service(3, { schemaOf: old });
    const r = await refusal(forms.getVersionArtifact(user, FORM_ID, versionId(1)));
    expect(r).toMatchObject({ status: 422, code: "FORM_INVALID" });
    expect(r.message).toMatch(/^This version can't be downloaded: .+/);
    expect(writes).toEqual([]);
  });
});
