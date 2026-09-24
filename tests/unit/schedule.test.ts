import { expect, it } from "vitest";
import {
  airlabsFlightSchema,
  normalizeSchedule,
  scheduleMatches,
  utcScheduleTime,
} from "../../src/lib/providers/schedule";
it("maps supplied schedule fields without inventing missing terminal or actual time", () => {
  const raw = airlabsFlightSchema.parse({
    flight_icao: "ZZZ100",
    dep_time_utc: "2026-09-19 23:30",
    arr_estimated_ts: 1789850000,
  });
  const record = normalizeSchedule(raw);
  expect(record.departure.scheduled).toBe("2026-09-19T23:30:00.000Z");
  expect(record.departure.actual).toBeNull();
  expect(record.departure.gate).toBeNull();
  expect(utcScheduleTime(null, "invalid")).toBeNull();
});
it("does not match reused callsigns without registration and observation window", () => {
  const record = normalizeSchedule(
    airlabsFlightSchema.parse({
      flight_icao: "ZZZ100",
      reg_number: "ZZ-TEST",
      dep_time_utc: "2026-09-19 23:30",
    }),
  );
  expect(
    scheduleMatches(
      record,
      "ZZZ100",
      "ZZ-OTHER",
      Date.parse("2026-09-20T01:00:00Z"),
    ),
  ).toBe(false);
  expect(
    scheduleMatches(
      record,
      "ZZZ100",
      "ZZ-TEST",
      Date.parse("2026-09-20T01:00:00Z"),
    ),
  ).toBe(true);
  expect(
    scheduleMatches(
      record,
      "ZZZ100",
      "ZZ-TEST",
      Date.parse("2026-09-22T01:00:00Z"),
    ),
  ).toBe(false);
});
