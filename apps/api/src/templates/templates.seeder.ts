import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { seedSystemTemplates } from "./system-templates";

/**
 * Loads the system templates at startup, so every environment has the ones in
 * the repo. It never stops the API: a bad file is skipped with an error naming
 * it, and any other failure is logged and startup carries on.
 */
@Injectable()
export class TemplatesSeeder implements OnModuleInit {
  private readonly log = new Logger("Templates");

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const { created, updated, unchanged, removed, skipped } = await seedSystemTemplates(
        this.prisma,
        undefined,
        (s) => this.log.error(`System template ${s.file} was skipped: ${s.reason}`),
      );
      this.log.log(
        `System templates: ${created} created, ${updated} updated, ${unchanged} unchanged, ${removed} removed, ${skipped.length} skipped`,
      );
    } catch (e) {
      this.log.error(`System templates weren't loaded: ${(e as Error).message}`);
    }
  }
}
