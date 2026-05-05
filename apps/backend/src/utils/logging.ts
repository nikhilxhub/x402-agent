import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

export type LogContext = Record<string, unknown>;

function normalizeLogContext(context?: LogContext) {
  if (!context) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined)
  );
}

export function logInfo(scope: string, message: string, context?: LogContext) {
  const normalized = normalizeLogContext(context);
  if (normalized) {
    console.log(`[${scope}] ${message}`, normalized);
    return;
  }

  console.log(`[${scope}] ${message}`);
}

export function logWarn(scope: string, message: string, context?: LogContext) {
  const normalized = normalizeLogContext(context);
  if (normalized) {
    console.warn(`[${scope}] ${message}`, normalized);
    return;
  }

  console.warn(`[${scope}] ${message}`);
}

export function logError(scope: string, message: string, context?: LogContext) {
  const normalized = normalizeLogContext(context);
  if (normalized) {
    console.error(`[${scope}] ${message}`, normalized);
    return;
  }

  console.error(`[${scope}] ${message}`);
}

export function getRequestId(res: Response) {
  return String((res.locals as Record<string, unknown>).requestId ?? "unknown");
}

export function getClientTraceId(res: Response) {
  const value = (res.locals as Record<string, unknown>).clientTraceId;
  return typeof value === "string" ? value : null;
}

export function attachRequestContext(req: Request, res: Response, next: NextFunction) {
  const requestIdHeader = req.header("x-request-id");
  const clientTraceIdHeader = req.header("x-client-trace-id");
  const requestId =
    typeof requestIdHeader === "string" && requestIdHeader.trim().length > 0
      ? requestIdHeader.trim()
      : randomUUID();
  const clientTraceId =
    typeof clientTraceIdHeader === "string" && clientTraceIdHeader.trim().length > 0
      ? clientTraceIdHeader.trim()
      : null;
  const startedAt = Date.now();

  (res.locals as Record<string, unknown>).requestId = requestId;
  (res.locals as Record<string, unknown>).clientTraceId = clientTraceId;
  res.setHeader("x-request-id", requestId);

  logInfo("HTTP", "request.start", {
    requestId,
    clientTraceId,
    method: req.method,
    path: req.originalUrl,
  });

  res.on("finish", () => {
    logInfo("HTTP", "request.finish", {
      requestId,
      clientTraceId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}
