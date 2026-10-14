import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, Template } from "@prisma/client";
import { FormSchema, TemplateKind, type TemplateSource } from "@formbuilder/form-schema";
import { PrismaService } from "../prisma/prisma.service";
import { assertCanEdit } from "../auth/can-edit";
import type { AuthUser } from "../auth/current-user.decorator";
import { prepareTemplateContent, sameTemplateContent } from "./template-content";

/** "system": made by us, seen by every organisation, read-only. "organisation": the caller's own. */
export type TemplateScope = "system" | "organisation";

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

/** Everything but the content: what a list shows. */
const SUMMARY = {
  id: true,
  orgId: true,
  kind: true,
  name: true,
  description: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

type Summary = Pick<Template, keyof typeof SUMMARY>;

/** A template as the API returns it: its scope instead of its organisation. */
function present<T extends Summary>(t: T) {
  const { orgId, ...rest } = t;
  return { ...rest, scope: (orgId === null ? "system" : "organisation") as TemplateScope };
}

function parseKind(raw: unknown): TemplateKind {
  const kind = TemplateKind.safeParse(raw);
  if (!kind.success) throw new BadRequestException('kind must be "form" or "group".');
  return kind.data;
}

function parseName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) throw new BadRequestException("A template needs a name.");
  if (name.length > NAME_MAX) throw new BadRequestException(`A template's name can be at most ${NAME_MAX} characters.`);
  return name;
}

function parseDescription(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") throw new BadRequestException("description must be text.");
  const description = raw.trim();
  if (description.length > DESCRIPTION_MAX) {
    throw new BadRequestException(`A template's description can be at most ${DESCRIPTION_MAX} characters.`);
  }
  return description || null;
}

const VERSION_CONFLICT = {
  message: "This template was saved elsewhere. Reload to get the latest version.",
  code: "VERSION_CONFLICT",
};

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** System templates and the caller's organisation's, optionally of one kind: system first, then by name. */
  async list(user: AuthUser, kind?: string) {
    const rows = await this.prisma.template.findMany({
      where: { OR: [{ orgId: null }, { orgId: user.orgId }], ...(kind === undefined ? {} : { kind: parseKind(kind) }) },
      select: SUMMARY,
      orderBy: { name: "asc" },
    });
    return rows.map(present).sort((a, b) => (a.scope === b.scope ? 0 : a.scope === "system" ? -1 : 1));
  }

  async get(user: AuthUser, id: string) {
    return present(await this.visible(user, id));
  }

  /** A form template, ready for `formFromTemplate`. 404 if the caller can't see it, 400 if it's a group template. */
  async formTemplate(user: AuthUser, id: string): Promise<TemplateSource<FormSchema>> {
    const t = await this.visible(user, id);
    if (t.kind !== "form") throw new BadRequestException(`"${t.name}" is a group template. Insert it into a form instead.`);
    return { id: t.id, version: t.version, name: t.name, content: FormSchema.parse(t.content) };
  }

  async create(user: AuthUser, body: { kind?: unknown; name?: unknown; description?: unknown; content?: unknown }) {
    await assertCanEdit(this.prisma, user);
    const kind = parseKind(body.kind);
    const name = parseName(body.name);
    const description = parseDescription(body.description);
    const content = prepareTemplateContent(kind, body.content);
    const created = await this.prisma.template.create({
      data: {
        orgId: user.orgId,
        kind,
        name,
        description,
        content: content as unknown as Prisma.InputJsonValue,
        createdBy: user.sub,
      },
    });
    return present(created);
  }

  /**
   * Rename, describe, or save new content. `version` goes up only when the
   * content changes. Send the `version` the edit started from to have a save
   * refused (409) when someone else saved in between.
   */
  async update(
    user: AuthUser,
    id: string,
    body: { kind?: unknown; name?: unknown; description?: unknown; content?: unknown; version?: unknown },
  ) {
    const t = await this.writable(user, id);
    if (body.kind !== undefined && body.kind !== t.kind) throw new BadRequestException("A template's kind can't be changed.");
    if (body.version !== undefined && body.version !== t.version) throw new ConflictException(VERSION_CONFLICT);
    const data: Prisma.TemplateUpdateManyMutationInput = {};
    if (body.name !== undefined) data.name = parseName(body.name);
    if (body.description !== undefined) data.description = parseDescription(body.description);
    if (body.content !== undefined) {
      const kind = t.kind as TemplateKind;
      const content = prepareTemplateContent(kind, body.content, t.content);
      if (!sameTemplateContent(kind, t.content, content)) {
        data.content = content as unknown as Prisma.InputJsonValue;
        data.version = t.version + 1;
      }
    }
    if (Object.keys(data).length) {
      // Only if nobody saved since it was read; otherwise their version would be lost.
      const { count } = await this.prisma.template.updateMany({ where: { id, version: t.version }, data });
      if (!count) throw new ConflictException(VERSION_CONFLICT);
    }
    return present(await this.prisma.template.findUniqueOrThrow({ where: { id } }));
  }

  async remove(user: AuthUser, id: string) {
    await this.writable(user, id);
    await this.prisma.template.delete({ where: { id } });
    return { ok: true };
  }

  /** Copy a system template, or one of the organisation's own, into an editable organisation template. */
  async duplicate(user: AuthUser, id: string) {
    const t = await this.visible(user, id);
    await assertCanEdit(this.prisma, user);
    const created = await this.prisma.template.create({
      data: {
        orgId: user.orgId,
        kind: t.kind,
        name: `Copy of ${t.name}`.slice(0, NAME_MAX),
        description: t.description,
        content: t.content as Prisma.InputJsonValue,
        createdBy: user.sub,
      },
    });
    return present(created);
  }

  /** A template the caller can see: a system template or their organisation's. Anything else is 404. */
  private async visible(user: AuthUser, id: string): Promise<Template> {
    const t = await this.prisma.template.findFirst({ where: { id, OR: [{ orgId: null }, { orgId: user.orgId }] } });
    if (!t) throw new NotFoundException("Template not found");
    return t;
  }

  /** A template the caller may change: their organisation's, and they're an author. */
  private async writable(user: AuthUser, id: string): Promise<Template> {
    const t = await this.visible(user, id);
    if (t.orgId === null) {
      throw new ForbiddenException("System templates can't be changed. Duplicate it to make your own copy.");
    }
    await assertCanEdit(this.prisma, user);
    return t;
  }
}
