import { expect, it } from "vitest";
import { nightOverlay } from "../../src/lib/map/night";
import { booleanPointInPolygon } from "@turf/turf";
it("produces bounded twilight geometry without crossing the date line", () => {
  const result = nightOverlay(Date.parse("2026-09-19T12:00:00Z"));
  expect(result.features.length).toBeGreaterThan(50);
  for (const feature of result.features) {
    const ring = feature.geometry.coordinates[0];
    expect(ring[0]).toEqual(ring.at(-1));
    for (const coordinate of ring) {
      expect(Math.abs(coordinate[0])).toBeLessThanOrEqual(180);
      expect(Math.abs(coordinate[1])).toBeLessThanOrEqual(85);
    }
  }
});
it("shades equatorial midnight below civil twilight even when both poles are above that threshold", () => {
  const night = nightOverlay(
    Date.parse("2026-09-19T12:00:00Z"),
  ).features.filter((feature) => feature.properties?.twilight === -6);
  expect(
    night.some((feature) => booleanPointInPolygon([170, 0], feature)),
  ).toBe(true);
  expect(night.some((feature) => booleanPointInPolygon([0, 0], feature))).toBe(
    false,
  );
});
