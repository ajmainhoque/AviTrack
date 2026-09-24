const SHELL = "avitrack-shell-v1";
const REFERENCE = "avitrack-reference-v1";
self.addEventListener("install", (event) => event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(["/offline.html", "/manifest.webmanifest", "/api/app-icon?size=192", "/api/app-icon?size=512"]))));
self.addEventListener("activate", (event) => event.waitUntil(Promise.all([caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("avitrack-") && ![SHELL, REFERENCE].includes(key)).map((key) => caches.delete(key)))), self.clients.claim()])));
async function remember(cacheName, request, response, limit) {
  if (!response.ok) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}
self.addEventListener("fetch", (event) => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/live") || url.pathname.startsWith("/api/weather") || url.pathname.startsWith("/api/schedule") || url.pathname.startsWith("/api/search") || url.searchParams.get("kind") === "route") return;
  const reference = url.pathname === "/api/airports" || url.pathname === "/api/enrichment";
  const asset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/maplibre/");
  if (request.mode !== "navigate" && !reference && !asset) return;
  event.respondWith((async () => {
    const cacheName = reference ? REFERENCE : SHELL;
    const cached = await caches.match(request);
    if (asset && cached) return cached;
    try { const response = await fetch(request); event.waitUntil(remember(cacheName, request, response.clone(), reference ? 30 : 100)); return response; }
    catch { return cached || (request.mode === "navigate" ? await caches.match("/offline.html") : new Response(JSON.stringify({ error: "Live data unavailable offline." }), { status: 503, headers: { "Content-Type": "application/json" } })); }
  })());
});