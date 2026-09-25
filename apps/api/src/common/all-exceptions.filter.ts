import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

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
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = "Internal server error";
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
      error: isHttp ? exception.name : "InternalServerError",
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
