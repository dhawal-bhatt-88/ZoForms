import "dotenv/config";
import "reflect-metadata";
import { mkdirSync } from "fs";
import { join } from "path";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import type { ServerResponse } from "http";
import { AppModule } from "./app.module";
import { env } from "./config/env";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { LoggingInterceptor } from "./common/logging.interceptor";
import { JwtService } from "@nestjs/jwt";
import { configureBodyParsing } from "./common/body-parsing";

/**
 * Allow the deployment's own host (web + admin + api share it, any port),
 * localhost in dev, and any explicitly-listed origins — but nothing else.
 * Comparing against the request's own Host makes this env-independent, so it
 * can never lock out the real web origin regardless of PUBLIC_* config.
 */
function corsAllowed(origin: string, reqHost: string | undefined): boolean {
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (reqHost && host === reqHost.split(":")[0]) return true;
    if (host === new URL(env.PUBLIC_TENANT_URL).hostname) return true;
    if (env.PUBLIC_API_URL && host === new URL(env.PUBLIC_API_URL).hostname) return true;
    return (env.CORS_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(origin);
  } catch {
    return false;
  }
}

async function bootstrap() {
  // Bodies are parsed by configureBodyParsing: a larger limit for saving a form,
  // 100 KB for everything else.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.disable("x-powered-by");
  configureBodyParsing(app, app.get(JwtService));

  // Security headers. CSP is disabled here (the API serves JSON + uploaded
  // assets, not app HTML); crossOriginResourcePolicy stays "cross-origin" so
  // the web runtime can still load uploaded images.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS locked to the deployment's own origins (no more reflect-any). Custom
  // middleware so we can compare against the request Host (env-independent).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && corsAllowed(origin, req.headers.host)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        req.headers["access-control-request-headers"] || "Content-Type,Authorization",
      );
      res.setHeader("Access-Control-Max-Age", "600");
      // Lets the web app read the artifact download's filename cross-origin.
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        return res.end();
      }
    }
    next();
  });

  // Consistent JSON errors + one log line per request, applied app-wide.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Local upload storage (dev). Served statically at /uploads with nosniff so a
  // mislabeled file can never be interpreted as executable HTML/JS.
  const uploads = join(process.cwd(), "uploads");
  mkdirSync(uploads, { recursive: true });
  app.useStaticAssets(uploads, {
    prefix: "/uploads/",
    setHeaders: (res: ServerResponse) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    },
  });

  await app.listen(env.PORT);
  Logger.log(
    `API running on http://localhost:${env.PORT} (health at /health)`,
    "Bootstrap",
  );
}

bootstrap();
