import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { seedSystemTemplates } from "./system-templates";

/** Loads the system templates at startup, so every environment has the ones in the repo. */
@Injectable()
export class TemplatesSeeder implements OnModuleInit {
  private readonly log = new Logger("Templates");

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const { created, updated, unchanged, removed } = await seedSystemTemplates(this.prisma);
    this.log.log(`System templates: ${created} created, ${updated} updated, ${unchanged} unchanged, ${removed} removed`);
  }
}
