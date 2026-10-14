/*
 * Load the system templates without starting the API:
 *   pnpm --filter api seed:templates [folder]
 * The folder defaults to prisma/templates. The API also does this at startup
 * (TemplatesSeeder). Safe to run any number of times. Prints the counts as
 * JSON; a skipped file is named on stderr and makes the exit code 1, though
 * every other file is still loaded.
 */
import "dotenv/config";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { seedSystemTemplates, SYSTEM_TEMPLATES_DIR } from "./system-templates";

const prisma = new PrismaClient();
const dir = process.argv[2] ? resolve(process.argv[2]) : SYSTEM_TEMPLATES_DIR;
seedSystemTemplates(prisma, dir, (s) => console.error(`System template ${s.file} was skipped: ${s.reason}`))
  .then((result) => {
    console.log(JSON.stringify({ ...result, skipped: result.skipped.map((s) => s.file) }));
    if (result.skipped.length) process.exitCode = 1;
  })
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
