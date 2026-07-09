import "dotenv/config";
import "reflect-metadata";
import { mkdirSync } from "fs";
import { join } from "path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true, credentials: true });

  // Local upload storage (dev). Served statically at /uploads.
  const uploads = join(process.cwd(), "uploads");
  mkdirSync(uploads, { recursive: true });
  app.useStaticAssets(uploads, { prefix: "/uploads/" });

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port} (health at /health)`);
}

bootstrap();
