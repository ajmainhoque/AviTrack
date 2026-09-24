import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { and, between, eq, ilike, or } from "drizzle-orm";
import tzLookup from "tz-lookup";
import { getDatabase } from "../db";
import * as tables from "../db/schema";
import {
  referenceSchema,
  type Airport,
  type AirportDetail,
  type ReferenceData,
} from "../aviation/reference";
import { distanceNm } from "../aviation/calculations";
import type { Coordinate } from "../aviation/model";
import { ProviderError } from "../providers/http";
let localData: Promise<ReferenceData> | null = null;
export function localReference() {
  if (!localData)
    localData = readFile(
      join(
        process.cwd(),
        "data",
        basename(process.env.REFERENCE_DATA_FILE || "ourairports.json"),
      ),
      "utf8",
    )
      .then((text) => referenceSchema.parse(JSON.parse(text)))
      .catch(() => {
        localData = null;
        throw new ProviderError(
          "Airport reference data not imported. Run npm run data:sync.",
          503,
        );
      });
  return localData;
}
const rank = (airport: Airport, query: string) =>
  [
    airport.ident,
    airport.icao_code,
    airport.iata_code,
    airport.gps_code,
    airport.local_code,
  ].some((code) => code?.toLowerCase() === query)
    ? 0
    : airport.type === "large_airport"
      ? 1
      : airport.type === "medium_airport"
        ? 2
        : 3;
export async function searchAirports(
  query: string,
  limit = 12,
): Promise<Airport[]> {
  const normalized = query.trim().toLowerCase();
  const database = getDatabase();
  if (database) {
    try {
      const pattern = `%${normalized.replace(/[\\%_]/g, "\\$&")}%`;
      const rows = await database
        .select({ data: tables.airports.data })
        .from(tables.airports)
        .where(
          or(
            ilike(tables.airports.ident, pattern),
            ilike(tables.airports.icaoCode, pattern),
            ilike(tables.airports.iataCode, pattern),
            ilike(tables.airports.gpsCode, pattern),
            ilike(tables.airports.localCode, pattern),
            ilike(tables.airports.name, pattern),
            ilike(tables.airports.municipality, pattern),
            ilike(tables.airports.country, pattern),
          ),
        )
        .limit(200);
      return rows
        .map((row) => row.data)
        .sort((left, right) => rank(left, normalized) - rank(right, normalized))
        .slice(0, limit);
    } catch {
      return searchLocal(normalized, limit);
    }
  }
  return searchLocal(normalized, limit);
}
async function searchLocal(query: string, limit: number) {
  const data = await localReference();
  const countries = new Set(
    data.countries
      .filter((country) => country.name.toLowerCase().includes(query))
      .map((country) => country.code),
  );
  return data.airports
    .filter(
      (airport) =>
        countries.has(airport.iso_country ?? "") ||
        [
          airport.ident,
          airport.icao_code,
          airport.iata_code,
          airport.gps_code,
          airport.local_code,
          airport.name,
          airport.municipality,
          airport.iso_country,
          airport.keywords,
        ].some((value) => value?.toLowerCase().includes(query)),
    )
    .sort((left, right) => rank(left, query) - rank(right, query))
    .slice(0, limit);
}
export async function getAirportDetail(
  code: string,
): Promise<AirportDetail | null> {
  const query = code.toUpperCase();
  const database = getDatabase();
  if (database) {
    try {
      const [record] = await database
        .select()
        .from(tables.airports)
        .where(
          or(
            eq(tables.airports.ident, query),
            eq(tables.airports.icaoCode, query),
            eq(tables.airports.iataCode, query),
            eq(tables.airports.gpsCode, query),
          ),
        )
        .limit(1);
      if (!record) return null;
      const airport = record.data;
      const [runways, frequencies, navaids, country, region] =
        await Promise.all([
          database
            .select()
            .from(tables.runways)
            .where(eq(tables.runways.airportIdent, airport.ident)),
          database
            .select()
            .from(tables.frequencies)
            .where(eq(tables.frequencies.airportIdent, airport.ident)),
          database
            .select()
            .from(tables.navaids)
            .where(
              and(
                between(
                  tables.navaids.latitude,
                  airport.latitude_deg - 1,
                  airport.latitude_deg + 1,
                ),
                between(
                  tables.navaids.longitude,
                  airport.longitude_deg - 2,
                  airport.longitude_deg + 2,
                ),
              ),
            ),
          database
            .select()
            .from(tables.countries)
            .where(eq(tables.countries.code, airport.iso_country ?? "")),
          database
            .select()
            .from(tables.regions)
            .where(eq(tables.regions.code, airport.iso_region ?? "")),
        ]);
      return {
        airport,
        runways: runways.map((row) => row.data),
        frequencies: frequencies.map((row) => row.data),
        navaids: nearbyNavaids(
          navaids.map((row) => row.data),
          airport,
        ),
        countryName: country[0]?.data.name ?? null,
        regionName: region[0]?.data.name ?? null,
        timezone: tzLookup(airport.latitude_deg, airport.longitude_deg),
        syncedAt: record.sourceUpdatedAt.getTime(),
        source: "OurAirports",
      };
    } catch {
      return localAirportDetail(query);
    }
  }
  return localAirportDetail(query);
}
function nearbyNavaids(navaids: ReferenceData["navaids"], airport: Airport) {
  return navaids
    .filter(
      (navaid) => navaid.latitude_deg != null && navaid.longitude_deg != null,
    )
    .map((navaid) => ({
      ...navaid,
      distanceNm: distanceNm(
        [airport.longitude_deg, airport.latitude_deg],
        [navaid.longitude_deg!, navaid.latitude_deg!],
      ),
    }))
    .filter((navaid) => navaid.distanceNm < 50)
    .sort((left, right) => left.distanceNm - right.distanceNm)
    .slice(0, 20);
}
async function localAirportDetail(
  query: string,
): Promise<AirportDetail | null> {
  const data = await localReference();
  const airport = data.airports.find((airport) =>
    [
      airport.ident,
      airport.icao_code,
      airport.iata_code,
      airport.gps_code,
      airport.local_code,
    ].includes(query),
  );
  if (!airport) return null;
  return {
    airport,
    runways: data.runways.filter(
      (runway) => runway.airport_ident === airport.ident,
    ),
    frequencies: data.frequencies.filter(
      (frequency) => frequency.airport_ident === airport.ident,
    ),
    navaids: nearbyNavaids(data.navaids, airport),
    countryName:
      data.countries.find((country) => country.code === airport.iso_country)
        ?.name ?? null,
    regionName:
      data.regions.find((region) => region.code === airport.iso_region)?.name ??
      null,
    timezone: tzLookup(airport.latitude_deg, airport.longitude_deg),
    syncedAt: data.syncedAt,
    source: "OurAirports",
  };
}
export async function nearbyAirports(coordinate: Coordinate, radius = 100) {
  const database = getDatabase();
  let airports: Airport[];
  let syncedAt: number;
  if (database) {
    try {
      const rows = await database
        .select()
        .from(tables.airports)
        .where(
          and(
            between(
              tables.airports.latitude,
              coordinate[1] - radius / 60,
              coordinate[1] + radius / 60,
            ),
            between(
              tables.airports.longitude,
              coordinate[0] -
                radius /
                  60 /
                  Math.max(0.1, Math.cos((coordinate[1] * Math.PI) / 180)),
              coordinate[0] +
                radius /
                  60 /
                  Math.max(0.1, Math.cos((coordinate[1] * Math.PI) / 180)),
            ),
          ),
        )
        .limit(3000);
      airports = rows.map((row) => row.data);
      syncedAt = rows[0]?.sourceUpdatedAt.getTime() ?? 0;
    } catch {
      const local = await localReference();
      airports = local.airports;
      syncedAt = local.syncedAt;
    }
  } else {
    const local = await localReference();
    airports = local.airports;
    syncedAt = local.syncedAt;
  }
  return {
    airports: airports
      .filter(
        (airport) =>
          airport.type !== "closed" && airport.type !== "closed_airport",
      )
      .map((airport) => ({
        ...airport,
        distanceNm: distanceNm(coordinate, [
          airport.longitude_deg,
          airport.latitude_deg,
        ]),
      }))
      .filter((airport) => airport.distanceNm <= radius)
      .sort((left, right) => left.distanceNm - right.distanceNm)
      .slice(0, 500),
    syncedAt,
    source: "OurAirports",
  };
}
