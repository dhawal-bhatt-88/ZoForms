import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
/** An error raised by the body parser before any handler runs, e.g. a body over its limit. */
function bodyParserError(e: unknown): { status: number; type: string; limit?: number } | null {
  if (typeof e !== "object" || e === null) return null;
  const { status, type, limit } = e as { status?: unknown; type?: unknown; limit?: unknown };
  return typeof status === "number" && status >= 400 && status < 500 && typeof type === "string" && type.startsWith("entity.")
    ? { status, type, limit: typeof limit === "number" ? limit : undefined }
    : null;
}

/** 102400 → "100 KB", 10485760 → "10 MB": the limit that refused the body (see body-parsing.ts). */
function describeBytes(bytes: number): string {
  return bytes >= 1024 * 1024 && bytes % (1024 * 1024) === 0 ? `${bytes / (1024 * 1024)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Catches everything that escapes a handler and returns one consistent JSON
 * error shape. Known `HttpException`s keep their status + message; anything
 * else becomes a 500 and is logged with a stack so it stays diagnosable.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    // A body the parser refused keeps its 4xx (e.g. 413) rather than becoming a 500.
    const parser = isHttp ? null : bodyParserError(exception);
    const status = isHttp ? exception.getStatus() : (parser?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    let message: string | string[] = "Internal server error";
    if (parser) {
      message =
        parser.type === "entity.too.large"
          ? `The request is too large.${parser.limit ? ` The limit is ${describeBytes(parser.limit)}.` : ""}`
          : "The request body couldn't be read.";
    }
    // Optional machine-readable reason, for clients that must tell apart errors
    // sharing a status (e.g. the two 409s a form save can return).
    let code: string | undefined;
    if (isHttp) {
      const body = exception.getResponse();
      message =
        typeof body === "string"
          ? body
          : ((body as Record<string, unknown>).message as string) ?? exception.message;
      if (typeof body === "object" && typeof (body as Record<string, unknown>).code === "string") {
        code = (body as Record<string, unknown>).code as string;
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      error: isHttp ? exception.name : parser ? "BadRequest" : "InternalServerError",
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
