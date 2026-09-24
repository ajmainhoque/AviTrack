import { expect, it } from "vitest";
import { appendObservation } from "../../src/lib/client/history";
import type { TrackPoint } from "../../src/lib/aviation/model";
const point = (timestamp: string, callsign = "ZZZ100"): TrackPoint => ({
  id: "fixture",
  flightId: `fixture:${callsign}`,
  timestamp: Date.parse(timestamp),
  coordinate: [0, 0],
  altitude: 30000,
  geometricAltitude: null,
  speed: 400,
  verticalRate: 0,
  track: 90,
  source: "test fixture",
  fields: {},
});
it("keeps a continuous flight in one session across UTC midnight", () => {
  const initial = appendObservation([], point("2026-09-19T23:59:55Z"));
  const continued = appendObservation(initial, point("2026-09-20T00:00:05Z"));
  expect(continued).toHaveLength(2);
  expect(continued[1].flightId).toBe(initial[0].flightId);
});
it("starts a new session after a long gap or callsign change", () => {
  const initial = appendObservation([], point("2026-09-19T12:00:00Z"));
  const later = appendObservation(initial, point("2026-09-19T13:00:00Z"));
  expect(later).toHaveLength(1);
  expect(later[0].flightId).not.toBe(initial[0].flightId);
  expect(
    appendObservation(initial, point("2026-09-19T12:00:05Z", "ZZZ101")),
  ).toHaveLength(1);
});
