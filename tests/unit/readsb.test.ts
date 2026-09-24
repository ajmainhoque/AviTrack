import { describe, expect, it } from "vitest";
import { normalizeReadsb } from "../../src/lib/providers/live/readsb";

describe("readsb normalization", () => {
  it("preserves ground, non-ICAO identifiers, trims callsigns and separates position/message age", () => {
    const result = normalizeReadsb(
      {
        now: 1_800_000_000_000,
        ac: [
          {
            hex: "~ABC123",
            flight: "BAW117  ",
            alt_baro: "ground",
            lat: 51,
            lon: 0,
            seen: 1,
            seen_pos: 50,
            mlat: ["lat", "lon"],
          },
        ],
      },
      "test fixture",
      1_800_000_000_000,
    );
    expect(result.aircraft[0].id).toBe("~abc123");
    expect(result.aircraft[0].callsign?.value).toBe("BAW117");
    expect(result.aircraft[0].altBaro?.value).toBe("ground");
    expect(result.aircraft[0].position?.ageSeconds).toBe(50);
    expect(result.aircraft[0].position?.isStale).toBe(true);
    expect(result.aircraft[0].positionSource).toBe("MLAT");
    expect(result.aircraft[0].messageAt).toBe(1_799_999_999_000);
  });
  it("accepts second timestamps and absent optional values without inventing them", () => {
    const result = normalizeReadsb(
      { now: 1_800_000_000, ac: [{ hex: "123456", seen: 0 }] },
      "fixture",
      1_800_000_000_000,
    );
    expect(result.aircraft[0].messageAt).toBe(1_800_000_000_000);
    expect(result.aircraft[0].position).toBeNull();
    expect(result.aircraft[0].registration).toBeNull();
  });
  it("rejects corrupt positions per aircraft and invalid envelopes", () => {
    expect(
      normalizeReadsb({ now: 1, ac: [{ hex: "abc", lat: 100 }] }, "fixture")
        .rejected,
    ).toBe(1);
    expect(() => normalizeReadsb({ now: 1 }, "fixture")).toThrow();
  });
});
