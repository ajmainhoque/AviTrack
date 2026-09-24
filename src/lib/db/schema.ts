import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type {
  Airport,
  Runway,
  Frequency,
  Navaid,
  ReferenceData,
} from "../aviation/reference";
export const airports = pgTable(
  "airports",
  {
    ident: text("ident").primaryKey(),
    id: integer("id").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    elevationFt: doublePrecision("elevation_ft"),
    country: text("country"),
    region: text("region"),
    municipality: text("municipality"),
    icaoCode: text("icao_code"),
    iataCode: text("iata_code"),
    gpsCode: text("gps_code"),
    localCode: text("local_code"),
    data: jsonb("data").$type<Airport>().notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("airports_iata_idx").on(table.iataCode),
    index("airports_icao_idx").on(table.icaoCode),
    index("airports_gps_idx").on(table.gpsCode),
    index("airports_local_idx").on(table.localCode),
    index("airports_name_idx").on(table.name),
    index("airports_city_idx").on(table.municipality),
    index("airports_country_idx").on(table.country),
    index("airports_coordinates_idx").on(table.latitude, table.longitude),
  ],
);
export const runways = pgTable(
  "runways",
  {
    id: integer("id").primaryKey(),
    airportIdent: text("airport_ident").notNull(),
    data: jsonb("data").$type<Runway>().notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("runways_airport_idx").on(table.airportIdent)],
);
export const frequencies = pgTable(
  "airport_frequencies",
  {
    id: integer("id").primaryKey(),
    airportIdent: text("airport_ident").notNull(),
    data: jsonb("data").$type<Frequency>().notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("frequencies_airport_idx").on(table.airportIdent)],
);
export const navaids = pgTable(
  "navaids",
  {
    id: integer("id").primaryKey(),
    ident: text("ident").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    airportIdent: text("airport_ident"),
    data: jsonb("data").$type<Navaid>().notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("navaids_airport_idx").on(table.airportIdent),
    index("navaids_coordinates_idx").on(table.latitude, table.longitude),
  ],
);
export const countries = pgTable("countries", {
  code: text("code").primaryKey(),
  data: jsonb("data").$type<ReferenceData["countries"][number]>().notNull(),
});
export const regions = pgTable("regions", {
  code: text("code").primaryKey(),
  data: jsonb("data").$type<ReferenceData["regions"][number]>().notNull(),
});
export const sourceSync = pgTable("source_sync", {
  source: text("source").primaryKey(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
  counts: jsonb("counts").$type<Record<string, number>>().notNull(),
});
export const quotaUsage = pgTable("provider_quota_usage", {
  key: text("key").primaryKey(),
  requests: integer("requests").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
export const watchlists = pgTable("watchlists", {
  key: text("key").primaryKey(),
  userId: text("user_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
