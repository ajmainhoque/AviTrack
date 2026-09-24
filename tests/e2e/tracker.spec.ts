import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PNG } from "pngjs";
import { mockProviders } from "./fixtures";
import { liveFixture } from "../fixtures/live";
test.beforeEach(async ({ page }) => {
  await mockProviders(page);
});
test("map renders nonblank pixels, aircraft selection, follow, source details and mobile sheet", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator('[data-map-ready="true"]')).toHaveAttribute(
    "data-aircraft-count",
    "2",
  );
  const canvas = page.locator(".maplibregl-canvas");
  const image = PNG.sync.read(await canvas.screenshot());
  const colors = new Set<string>();
  for (let index = 0; index < image.data.length; index += 64)
    colors.add(
      `${image.data[index]},${image.data[index + 1]},${image.data[index + 2]}`,
    );
  expect(colors.size).toBeGreaterThan(8);
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await canvas.click({
    position: { x: bounds!.width / 2, y: bounds!.height / 2 },
  });
  await expect(
    page.getByRole("complementary", { name: "Selected aircraft details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "TEST123", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const map = document.querySelector<HTMLElement>("[data-selected-screen]");
    const panel = document.querySelector(".flight-panel")?.getBoundingClientRect();
    const search = document.querySelector(".search-box")?.getBoundingClientRect();
    if (!map || !panel || !search) return false;
    const [horizontal, vertical] = JSON.parse(map.dataset.selectedScreen!) as [number, number];
    const bounds = map.getBoundingClientRect();
    const screenX = horizontal + bounds.left;
    const screenY = vertical + bounds.top;
    return screenY > search.bottom + 15 && (window.innerWidth <= 760 ? screenY < panel.top - 15 : screenX < panel.left - 15);
  })).toBe(true);
  await expect(
    page.getByText("Schedule provider not configured.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "ADS-B & sources" }).click();
  await expect(
    page.getByRole("heading", { name: "Position & freshness" }),
  ).toBeVisible();
  await expect(page.getByText("nic", { exact: true })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    const sheet = await page.locator(".flight-panel").boundingBox();
    expect(sheet!.y).toBeGreaterThan(200);
    expect(sheet!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await expect(page.locator("body")).not.toHaveJSProperty("scrollWidth", 0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("selected-aircraft.png") });
});
test("keyboard search, watchlist, unit preference and captured history", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Search flights, aircraft or airports" })
    .fill("TEST123");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "Search flights, aircraft or airports" })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "TEST123", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  await expect(
    page.getByRole("button", { name: "Remove from watchlist" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Units", exact: true })
    .selectOption("metric");
  await page
    .getByRole("button", { name: "Close Preferences", exact: true })
    .click();
  await expect(
    page.locator(".telemetry-grid").getByText(/km\/h/),
  ).toBeVisible();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play captured history" }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Play captured history" }).click();
  await expect(
    page.getByRole("heading", { name: "Local playback" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close flight details" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /TEST123 aircraft/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("avitrack-preferences-v1") || "{}")
          .state.units,
    ),
  ).toBe("metric");
});
test("airport search resolves reference page, runways, frequencies, METAR and TAF", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Search flights, aircraft or airports" })
    .fill("Heathrow");
  await page.getByRole("option", { name: /London Heathrow/ }).click();
  await expect(page).toHaveURL(/\/airport\/EGLL/);
  await expect(
    page.getByRole("heading", { name: "London Heathrow Airport", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Runways", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("118.500 MHz")).toBeVisible();
  await expect(page.locator(".weather-raw").first()).toContainText(
    "METAR EGLL",
  );
  await expect(page.locator(".weather-raw").last()).toContainText("TAF EGLL");
  await expect(
    page.getByText("NOTAM integration not configured."),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("airport.png"),
    fullPage: true,
  });
});
test("filters, world coverage, 429 and unavailable routes do not invent data", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-map-ready="true"]')).toHaveAttribute(
    "data-aircraft-count",
    "2",
  );
  await page
    .getByRole("button", { name: "Traffic filters", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("airborne");
  await expect(page.locator('[data-map-ready="true"]')).toHaveAttribute(
    "data-aircraft-count",
    "1",
  );
  await page
    .getByRole("button", { name: "Close Traffic filters", exact: true })
    .click();
  await page.route("**/api/live?**", (route) =>
    route.fulfill({
      status: 429,
      headers: { "Retry-After": "60" },
      json: { error: "Fixture provider rate-limited", retryAfter: 60 },
    }),
  );
  await expect(page.getByText(/Fixture provider rate-limited/)).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.goto("/map?zoom=2&lat=0&lon=0");
  await expect(
    page.getByText("Zoom in for live regional traffic", { exact: true }),
  ).toBeVisible();
});
test("primary interface has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-map-ready="true"]')).toHaveAttribute(
    "data-aircraft-count",
    "2",
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});

test("unknown routes and stale aircraft remain explicit without fabricated schedule or prediction", async ({ page }) => {
  await page.route("**/api/enrichment?**", (route) => route.fulfill({ json: { data: null } }));
  await page.goto("/map?aircraft=abc123");
  await expect(page.getByRole("heading", { name: "TEST123", exact: true })).toBeVisible();
  await expect(page.getByText("Origin and destination not available.")).toBeVisible();
  await expect(page.getByText("Schedule provider not configured.", { exact: false })).toBeVisible();
  await page.route("**/api/live?**", (route) => {
    const fixture = liveFixture();
    for (const aircraft of fixture.aircraft) if (aircraft.position) aircraft.position.observedAt = Date.now() - 70000;
    return route.fulfill({ json: fixture });
  });
  await expect(page.locator(".flight-heading .eyebrow")).toContainText("stale position");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.getByRole("tab", { name: "ADS-B & sources" }).click();
  await expect(page.getByRole("heading", { name: "Data details", exact: true })).toBeVisible();
});

test("hidden tabs suppress periodic live requests and resume on visibility", async ({ page }) => {
  let requests = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/live") requests++; });
  await page.goto("/");
  await expect(page.locator('[data-map-ready="true"]')).toHaveAttribute("data-aircraft-count", "2");
  await page.clock.install();
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  const before = requests;
  // Exercise polling deadlines without rendering every intervening WebGL frame.
  // fastForward still fires due timers, so hidden-tab polling remains covered.
  await page.clock.fastForward(16000);
  expect(requests).toBe(before);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.fastForward(6000);
  await expect.poll(() => requests).toBeGreaterThan(before);
});
