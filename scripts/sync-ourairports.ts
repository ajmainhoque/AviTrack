import nextEnv from "@next/env";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  airportSchema,
  runwaySchema,
  frequencySchema,
  navaidSchema,
  countrySchema,
  regionSchema,
  type ReferenceData,
} from "../src/lib/aviation/reference";
import * as tables from "../src/lib/db/schema";
nextEnv.loadEnvConfig(process.cwd());
async function download<T>(
  file: string,
  schema: z.ZodType<T>,
  required: string[],
) {
  const response = await fetch(
    `https://davidmegginson.github.io/ourairports-data/${file}.csv`,
    { signal: AbortSignal.timeout(60000) },
  );
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const text = await response.text();
  const rows: unknown[] = parse(text, {
    bom: true,
    columns: (columns: string[]) => {
      const missing = required.filter((column) => !columns.includes(column));
      if (missing.length)
        throw new Error(`${file}: missing columns ${missing.join(", ")}`);
      return columns;
    },
    skip_empty_lines: true,
  });
  const result = rows.map((row, index) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success)
      throw new Error(`${file} row ${index + 2}: ${parsed.error.message}`);
    return parsed.data;
  });
  console.log(`${file}: ${result.length.toLocaleString()} validated records`);
  return result;
}
const airports = await download("airports", airportSchema, [
  "id",
  "ident",
  "name",
  "latitude_deg",
  "longitude_deg",
  "iso_country",
  "gps_code",
  "iata_code",
]);
const runways = await download("runways", runwaySchema, [
  "id",
  "airport_ident",
  "length_ft",
  "le_ident",
  "he_ident",
]);
const frequencies = await download("airport-frequencies", frequencySchema, [
  "id",
  "airport_ident",
  "frequency_mhz",
]);
const navaids = await download("navaids", navaidSchema, [
  "id",
  "ident",
  "name",
  "latitude_deg",
  "longitude_deg",
  "frequency_khz",
]);
const countries = await download("countries", countrySchema, [
  "id",
  "code",
  "name",
]);
const regions = await download("regions", regionSchema, [
  "id",
  "code",
  "name",
  "iso_country",
]);
const syncedAt = Date.now();
const bundle: ReferenceData = {
  source: "OurAirports",
  syncedAt,
  airports,
  runways,
  frequencies,
  navaids,
  countries,
  regions,
};
await mkdir("data", { recursive: true });
await writeFile("data/ourairports.json.tmp", JSON.stringify(bundle));
await rename("data/ourairports.json.tmp", "data/ourairports.json");
const counts = {
  airports: airports.length,
  runways: runways.length,
  frequencies: frequencies.length,
  navaids: navaids.length,
  countries: countries.length,
  regions: regions.length,
};
if (process.env.DATABASE_URL && !process.argv.includes("--files-only")) {
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const database = drizzle(client);
  const updated = new Date(syncedAt);
  try {
    await database.transaction(async (transaction) => {
      for (let offset = 0; offset < airports.length; offset += 250) {
        await transaction
          .insert(tables.airports)
          .values(
            airports
              .slice(offset, offset + 250)
              .map((data) => ({
                ident: data.ident,
                id: data.id,
                type: data.type,
                name: data.name,
                latitude: data.latitude_deg,
                longitude: data.longitude_deg,
                elevationFt: data.elevation_ft,
                country: data.iso_country,
                region: data.iso_region,
                municipality: data.municipality,
                icaoCode: data.icao_code,
                iataCode: data.iata_code,
                gpsCode: data.gps_code,
                localCode: data.local_code,
                data,
                sourceUpdatedAt: updated,
              })),
          )
          .onConflictDoUpdate({
            target: tables.airports.ident,
            set: {
              id: sql`excluded.id`,
              name: sql`excluded.name`,
              type: sql`excluded.type`,
              latitude: sql`excluded.latitude`,
              longitude: sql`excluded.longitude`,
              elevationFt: sql`excluded.elevation_ft`,
              country: sql`excluded.country`,
              region: sql`excluded.region`,
              municipality: sql`excluded.municipality`,
              icaoCode: sql`excluded.icao_code`,
              iataCode: sql`excluded.iata_code`,
              gpsCode: sql`excluded.gps_code`,
              localCode: sql`excluded.local_code`,
              data: sql`excluded.data`,
              sourceUpdatedAt: updated,
            },
          });
      }
      for (let offset = 0; offset < runways.length; offset += 500)
        await transaction
          .insert(tables.runways)
          .values(
            runways
              .slice(offset, offset + 500)
              .map((data) => ({
                id: data.id,
                airportIdent: data.airport_ident,
                data,
                sourceUpdatedAt: updated,
              })),
          )
          .onConflictDoUpdate({
            target: tables.runways.id,
            set: {
              airportIdent: sql`excluded.airport_ident`,
              data: sql`excluded.data`,
              sourceUpdatedAt: updated,
            },
          });
      for (let offset = 0; offset < frequencies.length; offset += 500)
        await transaction
          .insert(tables.frequencies)
          .values(
            frequencies
              .slice(offset, offset + 500)
              .map((data) => ({
                id: data.id,
                airportIdent: data.airport_ident,
                data,
                sourceUpdatedAt: updated,
              })),
          )
          .onConflictDoUpdate({
            target: tables.frequencies.id,
            set: {
              airportIdent: sql`excluded.airport_ident`,
              data: sql`excluded.data`,
              sourceUpdatedAt: updated,
            },
          });
      for (let offset = 0; offset < navaids.length; offset += 500)
        await transaction
          .insert(tables.navaids)
          .values(
            navaids
              .slice(offset, offset + 500)
              .map((data) => ({
                id: data.id,
                ident: data.ident,
                airportIdent: data.associated_airport,
                latitude: data.latitude_deg,
                longitude: data.longitude_deg,
                data,
                sourceUpdatedAt: updated,
              })),
          )
          .onConflictDoUpdate({
            target: tables.navaids.id,
            set: {
              ident: sql`excluded.ident`,
              airportIdent: sql`excluded.airport_ident`,
              latitude: sql`excluded.latitude`,
              longitude: sql`excluded.longitude`,
              data: sql`excluded.data`,
              sourceUpdatedAt: updated,
            },
          });
      for (const data of countries)
        await transaction
          .insert(tables.countries)
          .values({ code: data.code, data })
          .onConflictDoUpdate({ target: tables.countries.code, set: { data } });
      for (let offset = 0; offset < regions.length; offset += 500)
        await transaction
          .insert(tables.regions)
          .values(
            regions
              .slice(offset, offset + 500)
              .map((data) => ({ code: data.code, data })),
          )
          .onConflictDoUpdate({
            target: tables.regions.code,
            set: { data: sql`excluded.data` },
          });
      await transaction
        .insert(tables.sourceSync)
        .values({ source: "OurAirports", syncedAt: updated, counts })
        .onConflictDoUpdate({
          target: tables.sourceSync.source,
          set: { syncedAt: updated, counts },
        });
    });
    console.log("PostgreSQL upsert committed.");
  } finally {
    await client.end();
  }
} else
  console.log(
    "Local reference snapshot written. PostgreSQL import skipped (no DATABASE_URL or --files-only).",
  );
console.log(
  JSON.stringify(
    {
      source: "OurAirports",
      syncedAt: new Date(syncedAt).toISOString(),
      ...counts,
    },
    null,
    2,
  ),
);
