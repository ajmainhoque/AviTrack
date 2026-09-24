import { z } from "zod";
const nullableText = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.string().nullable(),
);
const nullableNumber = z.preprocess(
  (value) => (value === "" || value == null ? null : Number(value)),
  z.number().finite().nullable(),
);
const number = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? Number(value) : value,
  z.number().finite(),
);
const flag = z.preprocess(
  (value) =>
    value === "1" || value === "yes"
      ? true
      : value === "0" || value === "no"
        ? false
        : value === "" || value == null
          ? null
          : value,
  z.boolean().nullable(),
);
export const airportSchema = z.object({
  id: number,
  ident: z.string().min(1),
  type: z.string(),
  name: z.string(),
  latitude_deg: number.pipe(z.number().min(-90).max(90)),
  longitude_deg: number.pipe(z.number().min(-180).max(180)),
  elevation_ft: nullableNumber,
  continent: nullableText,
  iso_country: nullableText,
  iso_region: nullableText,
  municipality: nullableText,
  scheduled_service: flag,
  gps_code: nullableText,
  icao_code: nullableText,
  iata_code: nullableText,
  local_code: nullableText,
  home_link: nullableText,
  wikipedia_link: nullableText,
  keywords: nullableText,
});
export const runwaySchema = z.object({
  id: number,
  airport_ref: number,
  airport_ident: z.string(),
  length_ft: nullableNumber,
  width_ft: nullableNumber,
  surface: nullableText,
  lighted: flag,
  closed: flag,
  le_ident: nullableText,
  le_latitude_deg: nullableNumber,
  le_longitude_deg: nullableNumber,
  le_elevation_ft: nullableNumber,
  le_heading_degT: nullableNumber,
  le_displaced_threshold_ft: nullableNumber,
  he_ident: nullableText,
  he_latitude_deg: nullableNumber,
  he_longitude_deg: nullableNumber,
  he_elevation_ft: nullableNumber,
  he_heading_degT: nullableNumber,
  he_displaced_threshold_ft: nullableNumber,
});
export const frequencySchema = z.object({
  id: number,
  airport_ref: number,
  airport_ident: z.string(),
  type: nullableText,
  description: nullableText,
  frequency_mhz: number,
});
export const navaidSchema = z.object({
  id: number,
  filename: nullableText,
  ident: z.string(),
  name: z.string(),
  type: z.string(),
  frequency_khz: nullableNumber,
  latitude_deg: nullableNumber,
  longitude_deg: nullableNumber,
  elevation_ft: nullableNumber,
  iso_country: nullableText,
  dme_frequency_khz: nullableNumber,
  dme_channel: nullableText,
  dme_latitude_deg: nullableNumber,
  dme_longitude_deg: nullableNumber,
  dme_elevation_ft: nullableNumber,
  slaved_variation_deg: nullableNumber,
  magnetic_variation_deg: nullableNumber,
  usageType: nullableText,
  power: nullableText,
  associated_airport: nullableText,
});
export const countrySchema = z.object({
  id: number,
  code: z.string(),
  name: z.string(),
  continent: nullableText,
  wikipedia_link: nullableText,
  keywords: nullableText,
});
export const regionSchema = countrySchema.extend({
  local_code: nullableText,
  iso_country: nullableText,
});
export const referenceSchema = z.object({
  syncedAt: z.number(),
  source: z.literal("OurAirports"),
  airports: z.array(airportSchema),
  runways: z.array(runwaySchema),
  frequencies: z.array(frequencySchema),
  navaids: z.array(navaidSchema),
  countries: z.array(countrySchema),
  regions: z.array(regionSchema),
});
export type Airport = z.infer<typeof airportSchema>;
export type Runway = z.infer<typeof runwaySchema>;
export type Frequency = z.infer<typeof frequencySchema>;
export type Navaid = z.infer<typeof navaidSchema>;
export type ReferenceData = z.infer<typeof referenceSchema>;
export interface AirportDetail {
  airport: Airport;
  runways: Runway[];
  frequencies: Frequency[];
  navaids: (Navaid & { distanceNm: number | null })[];
  countryName: string | null;
  regionName: string | null;
  timezone: string;
  syncedAt: number;
  source: "OurAirports";
}
