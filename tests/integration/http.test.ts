import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
beforeEach(() => {
  Reflect.deleteProperty(globalThis, "__avitrackHttp");
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("deduplicates concurrent requests and honors the cache TTL", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ value: 1 }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetch);
  const { providerRequest, responseReceivedAt } = await import("../../src/lib/providers/http");
  const schema = z.object({ value: z.number() });
  const first = providerRequest("adsblol", "/fixture", schema, 5000);
  const second = providerRequest("adsblol", "/fixture", schema, 5000);
  await vi.runAllTimersAsync();
  expect(await first).toEqual(await second);
  expect(fetch).toHaveBeenCalledTimes(1);
  const firstReceipt = responseReceivedAt(await first);
  await vi.advanceTimersByTimeAsync(1000);
  expect(responseReceivedAt(await providerRequest("adsblol", "/fixture", schema, 5000))).toBe(firstReceipt);
  expect(await providerRequest("adsblol", "/fixture", schema, 5000)).toEqual({
    value: 1,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("does not retry permanent 4xx and applies Retry-After provider-wide", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response("", { status: 429, headers: { "Retry-After": "60" } }),
    );
  vi.stubGlobal("fetch", fetch);
  const { providerRequest } = await import("../../src/lib/providers/http");
  const first = expect(
    providerRequest("adsblol", "/fixture", z.unknown(), 0),
  ).rejects.toMatchObject({ status: 429, retryAfter: 60 });
  await vi.runAllTimersAsync();
  await first;
  await expect(
    providerRequest("adsblol", "/other", z.unknown(), 0),
  ).rejects.toMatchObject({ status: 429 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("treats 204 as no data and supports HTTP-date Retry-After", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  );
  const { providerRequest, retryAfterSeconds } =
    await import("../../src/lib/providers/http");
  const result = providerRequest(
    "weather",
    "/fixture",
    z.array(z.unknown()),
    5000,
  );
  await vi.runAllTimersAsync();
  expect(await result).toEqual([]);
  expect(retryAfterSeconds("Thu, 01 Jan 1970 00:01:00 GMT", 0)).toBe(60);
});
