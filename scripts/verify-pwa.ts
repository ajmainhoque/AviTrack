import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const origin = process.env.APP_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "networkidle" });
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const manifestResponse = await fetch("/manifest.webmanifest");
    const manifest = await manifestResponse.json() as { icons: { src: string; sizes: string }[] };
    const icons = await Promise.all(manifest.icons.map(async (icon) => { const response = await fetch(icon.src); return { size: icon.sizes, status: response.status, type: response.headers.get("content-type") }; }));
    const entries: string[] = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) entries.push(request.url);
    return { controlled: Boolean(navigator.serviceWorker.controller), scope: registration.scope, icons, cached: entries.length, forbiddenCached: entries.filter((url) => /\/api\/(live|weather|schedule|search)/.test(url) || new URL(url).searchParams.get("kind") === "route") };
  });
  if (!state.controlled || state.forbiddenCached.length || state.icons.some((icon) => icon.status !== 200 || !icon.type?.includes("image/png"))) throw new Error(`PWA verification failed: ${JSON.stringify(state)}`);
  await context.setOffline(true);
  await page.goto(`${origin}/offline-verification`, { waitUntil: "domcontentloaded" });
  await page.getByText("Live data unavailable offline.", { exact: true }).waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/offline-fallback.png" });
  console.log(JSON.stringify({ ...state, offlineFallback: "passed" }, null, 2));
} finally { await browser.close(); }