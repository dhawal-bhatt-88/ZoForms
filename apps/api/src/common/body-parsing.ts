import { json, raw, urlencoded } from "body-parser";
import type { NextFunction, Request, Response } from "express";
import type { JwtService } from "@nestjs/jwt";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { BODY_LIMIT, SAVE_BODY_LIMIT } from "./limits";

/** The Stripe webhook: its signature is checked against the exact bytes received. */
export const WEBHOOK_PATH = "/v1/billing/webhook";
/** Saving a form's schema: `PUT /v1/forms/:id/schema`. */
const SAVE_PATH = /^\/v1\/forms\/[^/]+\/schema\/?$/;

/**
 * Request bodies, parsed in this order (Nest's own parsing is off: `bodyParser: false`):
 *
 *  1. The Stripe webhook keeps its raw bytes as `req.rawBody`, for the signature
 *     check, and nothing else reads its body.
 *  2. Saving a form, by a signed-in author, accepts JSON up to 10 MB: option
 *     lists have no size limit (contract §13.9), and a 5,000-option list is
 *     several hundred KB. The token is checked here, before the body is read,
 *     so an anonymous request never gets the larger limit.
 *  3. Everything else: JSON and form bodies up to 100 KB, as before.
 *
 * A body over its limit is a 413, named by AllExceptionsFilter.
 */
export function configureBodyParsing(app: NestExpressApplication, jwt: JwtService): void {
  const webhookBody = raw({ type: () => true, limit: BODY_LIMIT });
  app.use(WEBHOOK_PATH, (req: Request, res: Response, next: NextFunction) =>
    webhookBody(req, res, (err?: unknown) => {
      if (err) return next(err);
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      next();
    }),
  );

  const saveJson = json({ limit: SAVE_BODY_LIMIT });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "PUT" && SAVE_PATH.test(req.path) && signedIn(req, jwt)) return saveJson(req, res, next);
    next();
  });

  // body-parser skips a body that was already read, so these leave the two above alone.
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
}

/** Whether the request carries a valid sign-in token, checked as AuthGuard checks it. */
function signedIn(req: Request, jwt: JwtService): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  try {
    jwt.verify(header.slice(7));
    return true;
  } catch {
    return false;
  }
}
