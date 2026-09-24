import { z } from "zod";
import { sql } from "drizzle-orm";
import { config } from "../config/server";
import { getDatabase } from "../db";
import { quotaUsage } from "../db/schema";
import { dataValue, type DataValue } from "../aviation/model";
import type { ScheduleProvider, ScheduleRecord } from "./contracts";
import { ProviderError, providerRequest } from "./http";
const text = z.string().nullish();
const number = z.number().nullish();
export const airlabsFlightSchema = z
  .object({
    flight_iata: text,
    flight_icao: text,
    cs_flight_iata: text,
    reg_number: text,
    hex: text,
    status: text,
    dep_iata: text,
    dep_icao: text,
    arr_iata: text,
    arr_icao: text,
    dep_time_ts: number,
    dep_estimated_ts: number,
    dep_actual_ts: number,
    arr_time_ts: number,
    arr_estimated_ts: number,
    arr_actual_ts: number,
    dep_time_utc: text,
    dep_estimated_utc: text,
    dep_actual_utc: text,
    arr_time_utc: text,
    arr_estimated_utc: text,
    arr_actual_utc: text,
    dep_terminal: text,
    dep_gate: text,
    arr_terminal: text,
    arr_gate: text,
    arr_baggage: text,
    dep_delayed: number,
    arr_delayed: number,
  })
  .refine(
    (record) => record.flight_iata || record.flight_icao,
    "Missing flight identity",
  );
export function utcScheduleTime(
  timestamp?: number | null,
  utc?: string | null,
) {
  const time =
    timestamp != null
      ? timestamp * 1000
      : utc
        ? Date.parse(`${utc.replace(" ", "T").replace(/Z$/, "")}Z`)
        : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
export function normalizeSchedule(
  raw: z.infer<typeof airlabsFlightSchema>,
): ScheduleRecord {
  const scheduled = utcScheduleTime(raw.dep_time_ts, raw.dep_time_utc);
  return {
    flightNumber: raw.flight_icao || raw.flight_iata!,
    marketingFlight: raw.flight_iata ?? null,
    operatingFlight: raw.cs_flight_iata ?? null,
    date: scheduled?.slice(0, 10) ?? null,
    registration: raw.reg_number ?? null,
    origin: raw.dep_icao || raw.dep_iata || null,
    destination: raw.arr_icao || raw.arr_iata || null,
    status: raw.status ?? null,
    departureDelay: raw.dep_delayed ?? null,
    arrivalDelay: raw.arr_delayed ?? null,
    departure: {
      scheduled,
      estimated: utcScheduleTime(raw.dep_estimated_ts, raw.dep_estimated_utc),
      actual: utcScheduleTime(raw.dep_actual_ts, raw.dep_actual_utc),
      terminal: raw.dep_terminal ?? null,
      gate: raw.dep_gate ?? null,
    },
    arrival: {
      scheduled: utcScheduleTime(raw.arr_time_ts, raw.arr_time_utc),
      estimated: utcScheduleTime(raw.arr_estimated_ts, raw.arr_estimated_utc),
      actual: utcScheduleTime(raw.arr_actual_ts, raw.arr_actual_utc),
      terminal: raw.arr_terminal ?? null,
      gate: raw.arr_gate ?? null,
      baggage: raw.arr_baggage ?? null,
    },
  };
}
export function scheduleMatches(
  record: ScheduleRecord,
  callsign: string | null,
  registration: string | null,
  timestamp: number,
) {
  if (
    !callsign ||
    !registration ||
    !record.registration ||
    !record.departure.scheduled
  )
    return false;
  return (
    record.registration.toUpperCase() === registration.toUpperCase() &&
    [
      record.flightNumber,
      record.marketingFlight,
      record.operatingFlight,
    ].includes(callsign.toUpperCase()) &&
    Math.abs(timestamp - Date.parse(record.departure.scheduled)) < 24 * 3600000
  );
}
async function reserveCredit(explicit: boolean) {
  if (!config.SCHEDULE_TERMS_ACCEPTED || !config.SCHEDULE_API_KEY)
    throw new ProviderError(
      "Schedule access and license confirmation required",
      403,
    );
  const database = getDatabase();
  if (!database)
    throw new ProviderError(
      "Schedule quota protection requires PostgreSQL",
      503,
    );
  const budget = explicit
    ? config.SCHEDULE_MONTHLY_BUDGET
    : Math.floor(config.SCHEDULE_MONTHLY_BUDGET * 0.9);
  if (budget <= 0)
    throw new ProviderError(
      "Schedule quota is disabled or exhausted",
      429,
      3600,
    );
  const key = `airlabs:${new Date().toISOString().slice(0, 7)}`;
  const reserved = await database
    .insert(quotaUsage)
    .values({ key, requests: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: quotaUsage.key,
      set: { requests: sql`${quotaUsage.requests} + 1`, updatedAt: new Date() },
      setWhere: sql`${quotaUsage.requests} < ${budget}`,
    })
    .returning({ requests: quotaUsage.requests });
  if (!reserved.length)
    throw new ProviderError("Schedule monthly quota reached", 429, 3600);
}
const cache = new Map<
  string,
  { data: DataValue<ScheduleRecord[]>; expires: number }
>();
const pending = new Map<string, Promise<DataValue<ScheduleRecord[]>>>();
async function querySchedule(
  path: string,
  explicit: boolean,
  ttl: number,
): Promise<DataValue<ScheduleRecord[]>> {
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now()) return cached.data;
  const inflight = pending.get(path);
  if (inflight) return inflight;
  const work = (async () => {
    await reserveCredit(explicit);
    const envelope = z.object({
      response: z.union([airlabsFlightSchema, z.array(airlabsFlightSchema)]),
    });
    const response = await providerRequest(
      "airlabs",
      `${path}&api_key=${encodeURIComponent(config.SCHEDULE_API_KEY!)}`,
      envelope,
      ttl,
    );
    const records = Array.isArray(response.response)
      ? response.response
      : [response.response];
    const data = dataValue(
      records.map(normalizeSchedule),
      "AirLabs",
      null,
      Date.now(),
      "reported",
    );
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(path, { data, expires: Date.now() + ttl });
    return data;
  })();
  pending.set(path, work);
  try {
    return await work;
  } finally {
    pending.delete(path);
  }
}
export const scheduleProvider: ScheduleProvider = {
  getFlight(identifier, explicit) {
    return config.SCHEDULE_PROVIDER === "none"
      ? Promise.resolve(null)
      : querySchedule(
          `/schedules?${/^[A-Z]{2}\d/.test(identifier) ? "flight_iata" : "flight_icao"}=${encodeURIComponent(identifier)}`,
          explicit,
          60000,
        );
  },
};
export function airportBoard(
  airport: string,
  direction: "arrival" | "departure",
  explicit: boolean,
) {
  if (config.SCHEDULE_PROVIDER === "none") return Promise.resolve(null);
  return querySchedule(
    `/schedules?${direction === "arrival" ? "arr" : "dep"}_${airport.length === 3 ? "iata" : "icao"}=${encodeURIComponent(airport)}`,
    explicit,
    180000,
  );
}
