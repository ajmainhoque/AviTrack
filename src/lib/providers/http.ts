import { z } from "zod";
import { config } from "../config/server";

const upstreams = {
  adsblol: { base: "https://api.adsb.lol", interval: 1100 },
  airplanes: { base: "https://api.airplanes.live", interval: 1050 },
  adsbiq: {
    base: "https://api.adsbiq.com",
    interval: config.ADSBIQ_TIER === "free" ? 300000 : 20000,
  },
  opensky: { base: "https://opensky-network.org/api", interval: 10000 },
  adsbdb: { base: "https://api.adsbdb.com/v0", interval: 500 },
  weather: { base: "https://aviationweather.gov", interval: 1100 },
  airlabs: { base: "https://airlabs.co/api/v9", interval: 1100 },
} as const;
export type ProviderId = keyof typeof upstreams;
export interface ProviderHealth {
  provider: string;
  lastSuccess: number | null;
  latency: number | null;
  failures: number;
  retryAt: number;
  status: "idle" | "healthy" | "rate-limited" | "unavailable";
  requests: number;
  cacheHits: number;
}
interface HttpState {
  health: Map<ProviderId, ProviderHealth>;
  cache: Map<string, { data: unknown; expiresAt: number; weight: number }>;
  pending: Map<string, Promise<unknown>>;
  nextSlot: Map<ProviderId, number>;
}
const runtime = globalThis as typeof globalThis & {
  __avitrackHttp?: HttpState;
  __avitrackReceipts?: WeakMap<object, number>;
};
const receipts = runtime.__avitrackReceipts ??= new WeakMap<object, number>();
export function responseReceivedAt(response: unknown): number {
  return typeof response === "object" && response !== null ? receipts.get(response) ?? Date.now() : Date.now();
}
const { health, cache, pending, nextSlot } = (runtime.__avitrackHttp ??= {
  health: new Map(),
  cache: new Map(),
  pending: new Map(),
  nextSlot: new Map(),
});
export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 503,
    public retryAfter = 30,
  ) {
    super(message);
  }
}
export const getHealth = () => [...health.values()];
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export function retryAfterSeconds(header: string | null, now = Date.now()) {
  if (!header) return 30;
  const seconds = Number(header);
  return Number.isFinite(seconds)
    ? Math.max(1, seconds)
    : Math.max(1, (Date.parse(header) - now) / 1000 || 30);
}
export async function providerRequest<T>(
  provider: ProviderId,
  path: string,
  schema: z.ZodType<T>,
  ttlMs: number,
  headers: Record<string, string> = {},
  decode?: (response: Response) => Promise<unknown>,
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new ProviderError("Invalid provider path", 400);
  const key = `${provider}:${path}`;
  let status = health.get(provider);
  if (!status) {
    status = {
      provider,
      lastSuccess: null,
      latency: null,
      failures: 0,
      retryAt: 0,
      status: "idle",
      requests: 0,
      cacheHits: 0,
    };
    health.set(provider, status);
  }
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    status.cacheHits++;
    return cached.data as T;
  }
  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;
  if (status.retryAt > Date.now())
    throw new ProviderError(
      `${provider} cooling down`,
      status.status === "rate-limited" ? 429 : 503,
      Math.ceil((status.retryAt - Date.now()) / 1000),
    );
  const currentHealth = status;
  const work = (async () => {
    let lastError: unknown;
    for (
      let attempt = 0;
      attempt < (provider === "airlabs" ? 1 : 2);
      attempt++
    ) {
      const slot = Math.max(Date.now(), nextSlot.get(provider) ?? 0);
      if (slot - Date.now() > 8000)
        throw new ProviderError(
          `${provider} request budget reached`,
          429,
          Math.ceil((slot - Date.now()) / 1000),
        );
      nextSlot.set(provider, slot + upstreams[provider].interval);
      await wait(Math.max(0, slot - Date.now()));
      if (currentHealth.retryAt > Date.now())
        throw new ProviderError(
          `${provider} cooling down`,
          429,
          Math.ceil((currentHealth.retryAt - Date.now()) / 1000),
        );
      const started = Date.now();
      try {
        currentHealth.requests++;
        const response = await fetch(`${upstreams[provider].base}${path}`, {
          headers: {
            Accept: "application/json",
            "User-Agent":
              "AviTrack/1.0 (aviation information; no operational use)",
            ...headers,
          },
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
          redirect: "error",
        });
        if (response.status === 429) {
          const retry = retryAfterSeconds(
            response.headers.get("Retry-After") ??
              response.headers.get("X-Rate-Limit-Retry-After-Seconds"),
          );
          currentHealth.retryAt = Date.now() + retry * 1000;
          currentHealth.status = "rate-limited";
          throw new ProviderError(`${provider} rate-limited`, 429, retry);
        }
        if (!response.ok)
          throw new ProviderError(
            `${provider} returned HTTP ${response.status}`,
            response.status,
          );
        const parsed = schema.parse(
          response.status === 204
            ? []
            : decode
              ? await decode(response)
              : await response.json(),
        );
        currentHealth.lastSuccess = Date.now();
        if (typeof parsed === "object" && parsed !== null) receipts.set(parsed, currentHealth.lastSuccess);
        currentHealth.latency = Date.now() - started;
        currentHealth.failures = 0;
        currentHealth.status = "healthy";
        currentHealth.retryAt = 0;
        for (const [cachedKey, entry] of cache)
          if (entry.expiresAt <= Date.now() || cachedKey === key)
            cache.delete(cachedKey);
        const weight = JSON.stringify(parsed).length * 4;
        let totalWeight = [...cache.values()].reduce(
          (total, entry) => total + entry.weight,
          0,
        );
        while (
          cache.size &&
          (cache.size >= 512 || totalWeight + weight > 40 * 1024 * 1024)
        ) {
          const oldest = cache.keys().next().value!;
          totalWeight -= cache.get(oldest)!.weight;
          cache.delete(oldest);
        }
        if (weight <= 40 * 1024 * 1024)
          cache.set(key, {
            data: parsed,
            expiresAt: Date.now() + ttlMs,
            weight,
          });
        if (["info", "debug"].includes(config.LOG_LEVEL))
          console.info(
            JSON.stringify({
              event: "provider.success",
              provider,
              durationMs: currentHealth.latency,
            }),
          );
        return parsed;
      } catch (error) {
        lastError = error;
        if (
          error instanceof ProviderError &&
          error.status >= 400 &&
          error.status < 500
        )
          throw error;
        currentHealth.failures++;
        currentHealth.status = "unavailable";
        if (currentHealth.failures >= 3) {
          currentHealth.retryAt = Date.now() + 30000;
          break;
        }
        if (attempt === 0) await wait(300 + Math.random() * 400);
      }
    }
    if (config.LOG_LEVEL !== "silent")
      console.error(
        JSON.stringify({
          event: "provider.failure",
          provider,
          validation: lastError instanceof z.ZodError,
        }),
      );
    throw new ProviderError(`${provider} temporarily unavailable`);
  })();
  pending.set(key, work);
  try {
    return await work;
  } finally {
    pending.delete(key);
  }
}
