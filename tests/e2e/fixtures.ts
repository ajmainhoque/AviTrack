import type { Page } from "@playwright/test";
import { dataValue } from "../../src/lib/aviation/model";
import { liveFixture } from "../fixtures/live";
import reference from "../fixtures/reference.json" with { type: "json" };
export async function mockProviders(page: Page) {
  let sequence = 0;
  const now = Date.now();
  const airport = (ident: string) => {
    const record = reference.airports.find((item) => item.ident === ident)!;
    return {
      ident,
      name: record.name,
      iata: record.iata_code,
      coordinate: [record.longitude_deg, record.latitude_deg],
      municipality: record.municipality,
      country: record.iso_country,
    };
  };
  const metadata = dataValue(
    {
      registration: "ZZ-TEST",
      hex: "abc123",
      manufacturer: "Airbus",
      model: "A320 (CI fixture)",
      type: "A320",
      owner: "Test fixture operator",
      country: "Test fixture",
    },
    "CI fixture",
    null,
    now,
    "enriched",
  );
  const route = dataValue(
    {
      callsign: "TEST123",
      callsignIcao: "TEST123",
      callsignIata: null,
      airline: null,
      origin: airport("EGLL"),
      destination: airport("KJFK"),
      midpoint: null,
    },
    "CI fixture route",
    null,
    now,
    "enriched",
  );
  await page.route("https://tiles.openfreemap.org/**", async (request) => {
    const url = request.request().url();
    if (url.includes("/styles/"))
      return request.fulfill({
        json: {
          version: 8,
          glyphs:
            "https://tiles.openfreemap.org/test-fonts/{fontstack}/{range}.pbf",
          sources: {
            land: {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [-6, 49],
                      [-6, 56],
                      [0, 56],
                      [1, 52],
                      [0.5, 50],
                      [-6, 49],
                    ],
                  ],
                },
                properties: {},
              },
            },
          },
          layers: [
            {
              id: "water",
              type: "background",
              paint: { "background-color": "#c8d6dd" },
            },
            {
              id: "land",
              type: "fill",
              source: "land",
              paint: { "fill-color": "#e8eeea" },
            },
            {
              id: "coast",
              type: "line",
              source: "land",
              paint: { "line-color": "#93aaa0", "line-width": 2 },
            },
          ],
        },
      });
    return request.fulfill({
      status: 200,
      contentType: "application/x-protobuf",
      body: Buffer.alloc(0),
    });
  });
  await page.route("**/api/**", async (request) => {
    const url = new URL(request.request().url());
    const path = url.pathname;
    if (path === "/api/config")
      return request.fulfill({
        json: {
          provider: "fixture",
          refreshMs: 5000,
          selectedRefreshMs: 2500,
          global: false,
          stream: false,
          schedule: false,
          weather: true,
        },
      });
    if (path === "/api/live") {
      const data = liveFixture(sequence++);
      if (url.searchParams.has("id"))
        data.aircraft = data.aircraft.filter(
          (aircraft) => aircraft.id === url.searchParams.get("id"),
        );
      return request.fulfill({ json: data });
    }
    if (path === "/api/enrichment")
      return request.fulfill({
        json: {
          data: url.searchParams.get("kind") === "route" ? route : metadata,
        },
      });
    if (path === "/api/search") {
      const query = url.searchParams.get("q")?.toLowerCase() || "";
      return request.fulfill({
        json: {
          results:
            query.includes("heath") || ["lhr", "egll"].includes(query)
              ? [
                  {
                    id: "EGLL",
                    label: "LHR / London Heathrow Airport",
                    detail: "London / GB / EGLL",
                    category: "Airports",
                    href: "/airport/EGLL",
                  },
                ]
              : [
                  {
                    id: "abc123",
                    label: "TEST123",
                    detail: "ZZ-TEST / CI fixture",
                    category: "Aircraft",
                    aircraft: liveFixture().aircraft[0],
                    coordinate: [-0.2, 51.5],
                  },
                ],
          warnings: [],
        },
      });
    }
    if (path === "/api/airports")
      return request.fulfill({
        json: {
          airports: reference.airports.map((airport) => ({
            ...airport,
            distanceNm: 15,
          })),
          source: "CI reference fixture",
          syncedAt: now,
        },
      });
    if (path === "/api/map-reference")
      return request.fulfill({
        json: {
          airports: { type: "FeatureCollection", features: [] },
          runways: { type: "FeatureCollection", features: [] },
          navaids: { type: "FeatureCollection", features: [] },
          source: "CI fixture",
          syncedAt: now,
        },
      });
    if (path === "/api/weather")
      return request.fulfill({
        json: {
          metar: dataValue(
            {
              icaoId: "EGLL",
              obsTime: now / 1000,
              rawOb: "METAR EGLL 190850Z 23016KT 9999 SCT031 19/14 Q1015",
              temp: 19,
              dewp: 14,
              wspd: 16,
              wdir: 230,
              altim: 1015,
              visib: "6+",
              clouds: [{ cover: "SCT", base: 3100 }],
              fltCat: "VFR",
            },
            "CI weather fixture",
            now,
            now,
          ),
          taf: dataValue(
            {
              icaoId: "EGLL",
              issueTime: now / 1000,
              rawTAF: "TAF EGLL 190500Z 1906/2012 23012KT 9999 SCT030",
              fcsts: [],
            },
            "CI weather fixture",
            now,
            now,
            "reported",
          ),
          errors: [],
        },
      });
    if (path === "/api/health")
      return request.fulfill({
        json: {
          preferred: "fixture",
          fallback: "none",
          refreshMs: 5000,
          database: false,
          providers: [],
        },
      });
    if (path === "/api/schedule")
      return request.fulfill({ json: { configured: false, data: null } });
    if (path === "/api/app-icon") return request.continue();
    return request.fulfill({
      status: 404,
      json: { error: "No fixture for this endpoint" },
    });
  });
}
