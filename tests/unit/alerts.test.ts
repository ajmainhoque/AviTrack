import { expect, it } from "vitest";
import { normalizeReadsb } from "../../src/lib/providers/live/readsb";
import { observationAlerts } from "../../src/lib/aviation/alerts";
const aircraft = (raw: Record<string, unknown>) => normalizeReadsb({ now: 1800000000, ac: [{ hex: "abc123", lat: 0, lon: 0, seen: 0, seen_pos: 0, ...raw }] }, "fixture", 1800000000000).aircraft[0];
it("reports explicit squawk transitions without inferring an emergency from motion", () => {
  const previous = aircraft({ squawk: "1234", alt_baro: 30000 }); const current = aircraft({ squawk: "7700", alt_baro: 20000 });
  expect(observationAlerts(previous, current, 1800000000000)).toContain("abc123: Transponder reports 7700");
  expect(observationAlerts(previous, aircraft({ squawk: "1234", alt_baro: 20000 }), 1800000000000)).toEqual([]);
});
it("labels ground/air transitions inferred and suppresses old observations", () => {
  const previous = aircraft({ alt_baro: "ground" }); const current = aircraft({ alt_baro: 1000, gs: 120 });
  expect(observationAlerts(previous, current, 1800000000000)[0]).toContain("inferred takeoff");
  expect(observationAlerts(previous, current, 1800000200000)).toEqual([]);
});