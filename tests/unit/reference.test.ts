import { expect, it } from "vitest";
import { airportSchema, runwaySchema } from "../../src/lib/aviation/reference";
import { mapAirport } from "../../src/lib/providers/enrichment";
it("normalizes empty CSV values to null, retaining zero and airports without IATA", () => {
  const result = airportSchema.parse({
    id: "1",
    ident: "ZZ-001",
    type: "small_airport",
    name: "Test fixture airport",
    latitude_deg: "0",
    longitude_deg: "0",
    elevation_ft: "",
    scheduled_service: "no",
    iata_code: "",
  });
  expect(result.elevation_ft).toBeNull();
  expect(result.iata_code).toBeNull();
  expect(result.latitude_deg).toBe(0);
  expect(result.scheduled_service).toBe(false);
});
it("preserves runway end fields and explicit false values", () => {
  const runway = runwaySchema.parse({
    id: "1",
    airport_ref: "1",
    airport_ident: "ZZ-001",
    closed: "0",
    lighted: "1",
    le_ident: "09",
    he_ident: "27",
    le_heading_degT: "90",
  });
  expect(runway.closed).toBe(false);
  expect(runway.lighted).toBe(true);
  expect(runway.le_heading_degT).toBe(90);
  expect(runway.he_displaced_threshold_ft).toBeNull();
});
it("maps route airport longitude before latitude without inventing IATA", () => {
  const airport = mapAirport({
    icao_code: "ZZZZ",
    name: "Fixture",
    latitude: 10,
    longitude: 20,
    iata_code: "",
  });
  expect(airport.coordinate).toEqual([20, 10]);
  expect(airport.iata).toBeNull();
});
