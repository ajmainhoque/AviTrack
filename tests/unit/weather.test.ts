import { expect, it } from "vitest";
import {
  flightCategory,
  ceilingFeet,
  metarSchema,
  weatherGeoSchema,
} from "../../src/lib/providers/weather";
it("derives US weather categories from the worse of visibility and ceiling", () => {
  const report = metarSchema.parse({
    icaoId: "ZZZZ",
    obsTime: 1,
    rawOb: "TEST FIXTURE",
    visib: "6+",
    clouds: [{ cover: "BKN", base: 900 }],
  });
  expect(flightCategory(report)).toBe("IFR");
  expect(ceilingFeet(report)).toBe(900);
  expect(flightCategory({ ...report, visib: 0.5 })).toBe("LIFR");
  expect(
    flightCategory({ ...report, clouds: [{ cover: "SCT", base: 1000 }] }),
  ).toBe("VFR");
  expect(
    flightCategory({ icaoId: "ZZZZ", obsTime: 1, rawOb: "TEST FIXTURE" }),
  ).toBeNull();
});
it("rejects malformed weather geometry", () => {
  expect(
    weatherGeoSchema.safeParse({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: ["not", "coordinates"] },
        },
      ],
    }).success,
  ).toBe(false);
});
