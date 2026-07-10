import "dotenv/config";
import "reflect-metadata";
import { mkdirSync } from "fs";
import { join } from "path";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { env } from "./config/env";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { LoggingInterceptor } from "./common/logging.interceptor";

async function bootstrap() {
  // rawBody keeps the raw buffer available for Stripe webhook signature checks.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.enableCors({ origin: true, credentials: true });

  // Consistent JSON errors + one log line per request, applied app-wide.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Local upload storage (dev). Served statically at /uploads.
  const uploads = join(process.cwd(), "uploads");
  mkdirSync(uploads, { recursive: true });
  app.useStaticAssets(uploads, { prefix: "/uploads/" });

  await app.listen(env.PORT);
  Logger.log(
    `API running on http://localhost:${env.PORT} (health at /health)`,
    "Bootstrap",
  );
}

bootstrap();
