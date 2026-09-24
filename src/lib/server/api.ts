import { z } from "zod";
import { config } from "../config/server";
import { ProviderError } from "../providers/http";
const clients = new Map<string, { count: number; resets: number }>();
export function guard(request: Request) {
  const ip = config.TRUST_PROXY
    ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous")
    : "shared";
  let budget = clients.get(ip);
  if (!budget || budget.resets <= Date.now()) {
    budget = { count: 0, resets: Date.now() + 60000 };
    clients.set(ip, budget);
  }
  if (clients.size > 5000)
    for (const [key, value] of clients)
      if (value.resets < Date.now()) clients.delete(key);
  if (++budget.count > (config.TRUST_PROXY ? 100 : 1000))
    throw new ProviderError("Request limit reached", 429, 60);
}
export function apiError(error: unknown): Response {
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: "Invalid request",
        details: error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  const status =
    error instanceof ProviderError
      ? error.status === 404
        ? 404
        : error.status >= 400 && error.status < 500
          ? error.status
          : 503
      : 503;
  return Response.json(
    {
      error:
        error instanceof ProviderError
          ? error.message
          : "Service temporarily unavailable",
      retryAfter: error instanceof ProviderError ? error.retryAfter : 30,
    },
    {
      status,
      headers: {
        "Retry-After": String(
          error instanceof ProviderError ? error.retryAfter : 30,
        ),
        "Cache-Control": "no-store",
      },
    },
  );
}
export const identifierSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z0-9~-]+$/);
