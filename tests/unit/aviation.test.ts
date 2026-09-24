import { describe, expect, it } from "vitest";
import {
  distanceNm,
  bearingDegrees,
  interpolatePosition,
  splitAntimeridian,
  freshness,
  emergency,
  plausiblePosition,
  compressTrack,
  inferPhase,
  estimateProgress,
} from "../../src/lib/aviation/calculations";
import {
  convert,
  formatAltitude,
  formatTime,
} from "../../src/lib/aviation/units";
import { normalizeReadsb } from "../../src/lib/providers/live/readsb";
import type { TrackPoint } from "../../src/lib/aviation/model";
const point = (
  timestamp: number,
  longitude = 0,
  altitude: number | "ground" = 30000,
  verticalRate = 0,
): TrackPoint => ({
  id: "fixture",
  flightId: "fixture:test",
  timestamp,
  coordinate: [longitude, 0],
  altitude,
  geometricAltitude: null,
  speed: 400,
  track: 90,
  verticalRate,
  source: "test fixture",
  fields: {},
});
describe("aviation calculations", () => {
  it("uses great-circle distance and bearing", () => {
    expect(distanceNm([0, 0], [1, 0])).toBeCloseTo(60.04, 1);
    expect(bearingDegrees([0, 0], [1, 0])).toBe(90);
  });
  it("interpolates across the date line along the short arc", () => {
    expect(
      Math.abs(interpolatePosition([179, 0], [-179, 0], 0.5)[0]),
    ).toBeCloseTo(180);
  });
  it("splits both directions at the anti-meridian without world-spanning segments", () => {
    for (const path of [
      [
        [179, 10],
        [-179, 11],
      ],
      [
        [-179, 10],
        [179, 11],
      ],
    ] as [number, number][][]) {
      const parts = splitAntimeridian(path);
      expect(parts).toHaveLength(2);
      for (const segment of parts)
        expect(Math.abs(segment[1][0] - segment[0][0])).toBeLessThan(3);
    }
  });
  it("classifies freshness using position age and reports only explicit emergencies", () => {
    expect(freshness(0, 31000)).toBe("stale");
    expect(freshness(null)).toBe("unknown");
    expect(emergency("7700")).toBe("Transponder reports 7700");
    expect(emergency("1234")).toBeNull();
  });
  it("rejects impossible jumps and duplicate timestamps, allows fast aircraft", () => {
    expect(plausiblePosition(point(0), point(1000, 20))).toBe(false);
    expect(plausiblePosition(point(0), point(0))).toBe(false);
    expect(plausiblePosition(point(0), point(10000, 0.08))).toBe(true);
  });
  it("compresses stationary samples but preserves altitude changes and endpoints", () => {
    const points = Array.from({ length: 60 }, (_, index) =>
      point(index * 1000),
    );
    const compressed = compressTrack(points);
    expect(compressed.length).toBeLessThan(10);
    expect(compressed.at(-1)).toBe(points.at(-1));
    points[10].altitude = "ground";
    expect(compressTrack(points)).toContain(points[10]);
  });
  it("requires a stable time window for inferred phase", () => {
    expect(inferPhase([point(0)])).toBe("unknown");
    expect(
      inferPhase([
        point(0, 0, 30000, 800),
        point(5000, 0, 30000, 800),
        point(10000, 0, 30000, 800),
      ]),
    ).toBe("climb");
    expect(
      inferPhase([point(0), point(5000), point(10000, 0, 30000, -800)]),
    ).toBe("unknown");
  });
  it("suppresses ETA for ground, stale and wrong-direction states", () => {
    const aircraft = normalizeReadsb(
      {
        now: 1000,
        ac: [
          {
            hex: "fixture",
            lat: 0,
            lon: 1,
            alt_baro: 30000,
            gs: 400,
            track: 90,
            seen: 0,
            seen_pos: 0,
          },
        ],
      },
      "fixture",
      1000000,
    ).aircraft[0];
    expect(
      estimateProgress(aircraft, [0, 0], [10, 0], 1000000)?.etaMinutes,
    ).toBeGreaterThan(0);
    expect(
      estimateProgress(aircraft, [0, 0], [-10, 0], 1000000)?.etaMinutes,
    ).toBeNull();
    expect(
      estimateProgress(aircraft, [0, 0], [10, 0], 1100000)?.etaMinutes,
    ).toBeNull();
  });
});
describe("units and time", () => {
  it("centralizes unit conversions and ground formatting", () => {
    expect(convert(1000, "altitude", "metric")).toBeCloseTo(304.8);
    expect(convert(100, "speed", "metric")).toBeCloseTo(185.2);
    expect(convert(0, "temperature", "us")).toBe(32);
    expect(formatAltitude("ground", "metric")).toBe("On ground");
  });
  it("handles DST through IANA time zones", () => {
    expect(
      formatTime(Date.parse("2026-03-29T00:30:00Z"), "Europe/London"),
    ).toContain("00:30");
    expect(
      formatTime(Date.parse("2026-03-29T01:30:00Z"), "Europe/London"),
    ).toContain("02:30");
  });
});
