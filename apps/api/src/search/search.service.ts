import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../config/env";

const INDEX = "responses";

type ResponseRow = {
  id: string;
  formId: string;
  data: unknown;
  createdAt: Date;
};

/**
 * Full-text response search.
 *
 * Uses Meilisearch when `MEILI_HOST` is set; otherwise falls back to a Postgres
 * `ILIKE` scan over the response JSON so search works out of the box with no
 * extra infrastructure.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger("Search");
  readonly enabled = !!env.MEILI_HOST;

  constructor(private readonly prisma: PrismaService) {}

  /** Search a form's completed responses. Returns rows shaped like listResponses. */
  async search(formId: string, query: string): Promise<ResponseRow[]> {
    const q = query.trim();
    if (!q) {
      return this.prisma.response.findMany({
        where: { formId, partial: false },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    }
    if (this.enabled) {
      try {
        return await this.meiliSearch(formId, q);
      } catch (e) {
        this.logger.warn(`Meili search failed, using Postgres: ${(e as Error).message}`);
      }
    }
    return this.pgSearch(formId, q);
  }

  /** Add/replace a response in the index (no-op without Meili). Fire-and-forget. */
  async index(response: { id: string; formId: string; data: unknown; createdAt: Date }) {
    if (!this.enabled) return;
    const doc = {
      id: response.id,
      formId: response.formId,
      text: flatten(response.data),
      createdAt: response.createdAt.getTime(),
    };
    try {
      await this.meili(`/indexes/${INDEX}/documents`, "POST", [doc]);
    } catch (e) {
      this.logger.warn(`Meili index failed: ${(e as Error).message}`);
    }
  }

  /* ---------- Postgres fallback ---------- */

  private async pgSearch(formId: string, q: string): Promise<ResponseRow[]> {
    const like = `%${q}%`;
    return this.prisma.$queryRaw<ResponseRow[]>(
      Prisma.sql`
        SELECT "id", "formId", "data", "createdAt"
        FROM "Response"
        WHERE "formId" = ${formId}
          AND "partial" = false
          AND "data"::text ILIKE ${like}
        ORDER BY "createdAt" DESC
        LIMIT 100`,
    );
  }

  /* ---------- Meilisearch ---------- */

  private async meiliSearch(formId: string, q: string): Promise<ResponseRow[]> {
    const body = await this.meili(`/indexes/${INDEX}/search`, "POST", {
      q,
      filter: `formId = "${formId}"`,
      limit: 100,
    });
    const hits = (body as { hits?: { id: string }[] }).hits ?? [];
    if (!hits.length) return [];
    const ids = hits.map((h) => h.id);
    const rows = await this.prisma.response.findMany({ where: { id: { in: ids } } });
    // Preserve Meili's relevance ordering.
    const order = new Map(ids.map((id, i) => [id, i]));
    return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  private async meili(path: string, method: string, body: unknown) {
    const res = await fetch(`${env.MEILI_HOST!.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(env.MEILI_KEY ? { Authorization: `Bearer ${env.MEILI_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Meili ${res.status}`);
    return res.json();
  }
}

/** Flatten response values into one searchable string. */
function flatten(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "object") return Object.values(data as Record<string, unknown>).map(flatten).join(" ");
  if (Array.isArray(data)) return (data as unknown[]).map(flatten).join(" ");
  return String(data);
}
