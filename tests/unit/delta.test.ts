import { expect, it } from "vitest";
import { AircraftDeltaStore } from "../../src/lib/providers/live/delta";
it("object-merges sparse patches, preserves position age, adds and removes IDs", () => {
  const store = new AircraftDeltaStore();
  store.apply(
    {
      type: "full",
      seq: 10,
      now: 1000,
      ac: [
        {
          hex: "abc123",
          r: "ZZ-TEST",
          lat: 10,
          lon: 20,
          alt_baro: 30000,
          seen: 0,
          seen_pos: 0,
        },
      ],
    },
    1000000,
  );
  const result = store.apply(
    {
      type: "delta",
      seq: 11,
      now: 1005,
      update: [{ hex: "abc123", alt_baro: 31000, seen: 0 }],
      new: [{ hex: "def456" }],
    },
    1005000,
  );
  expect(result.aircraft[0].registration?.value).toBe("ZZ-TEST");
  expect(result.aircraft[0].position?.value).toEqual([20, 10]);
  expect(result.aircraft[0].position?.ageSeconds).toBe(5);
  expect(result.aircraft[0].altBaro?.value).toBe(31000);
  expect(
    store
      .apply({ type: "delta", seq: 12, remove: ["ABC123"] }, 1006000)
      .aircraft.map((aircraft) => aircraft.id),
  ).toEqual(["def456"]);
});
it("requires a fresh full snapshot after a sequence gap and replaces authoritative state", () => {
  const store = new AircraftDeltaStore();
  store.apply({ type: "full", seq: 1, ac: [{ hex: "abc123" }] });
  expect(() =>
    store.apply({ type: "delta", seq: 3, update: [{ hex: "abc123" }] }),
  ).toThrow("sequence gap");
  expect(store.snapshot().aircraft).toHaveLength(0);
  expect(
    store.apply({ type: "full", seq: 7, ac: [{ hex: "def456" }] }).aircraft[0]
      .id,
  ).toBe("def456");
});
