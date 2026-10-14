/*
 * Load the system templates without starting the API:
 *   pnpm --filter api seed:templates
 * The API also does this at startup (TemplatesSeeder). Safe to run any number of times.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedSystemTemplates } from "./system-templates";

const prisma = new PrismaClient();
seedSystemTemplates(prisma)
  .then((counts) => console.log(JSON.stringify(counts)))
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
