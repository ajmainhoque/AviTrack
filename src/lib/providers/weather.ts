import { z } from "zod";
import { gunzipSync } from "node:zlib";
import { parse } from "csv-parse/sync";
import { dataValue, type DataValue } from "../aviation/model";
import { providerRequest } from "./http";
const optionalNumber = z.number().nullish();
const cloudSchema = z.object({ cover: z.string(), base: optionalNumber });
export const metarSchema = z.object({
  icaoId: z.string(),
  obsTime: z.number(),
  receiptTime: z.string().optional(),
  reportTime: z.string().optional(),
  temp: optionalNumber,
  dewp: optionalNumber,
  wdir: z.union([z.number(), z.string()]).nullish(),
  wspd: optionalNumber,
  wgst: optionalNumber,
  visib: z.union([z.number(), z.string()]).nullish(),
  altim: optionalNumber,
  rawOb: z.string(),
  lat: optionalNumber,
  lon: optionalNumber,
  clouds: z.array(cloudSchema).nullish(),
  cover: z.string().nullish(),
  fltCat: z.string().nullish(),
});
const forecastSchema = z
  .object({
    timeFrom: optionalNumber,
    timeTo: optionalNumber,
    fcstChange: z.string().nullish(),
    wdir: z.union([z.number(), z.string()]).nullish(),
    wspd: optionalNumber,
    wgst: optionalNumber,
    visib: z.union([z.number(), z.string()]).nullish(),
    clouds: z.array(cloudSchema).nullish(),
  })
  .catchall(z.unknown());
export const tafSchema = z.object({
  icaoId: z.string(),
  rawTAF: z.string(),
  issueTime: z.union([z.number(), z.string()]),
  validTimeFrom: optionalNumber,
  validTimeTo: optionalNumber,
  fcsts: z.array(forecastSchema).default([]),
});
export type Metar = z.infer<typeof metarSchema>;
export type Taf = z.infer<typeof tafSchema>;
export interface StationWeather {
  metar: DataValue<Metar> | null;
  taf: DataValue<Taf> | null;
  errors: string[];
}
export function flightCategory(
  metar: Metar,
): "VFR" | "MVFR" | "IFR" | "LIFR" | null {
  const visibility =
    metar.visib == null ? null : Number.parseFloat(String(metar.visib));
  const ceiling =
    metar.clouds
      ?.filter(
        (cloud) =>
          ["BKN", "OVC", "VV"].includes(cloud.cover) && cloud.base != null,
      )
      .reduce((lowest, cloud) => Math.min(lowest, cloud.base!), Infinity) ??
    null;
  if (
    (visibility != null && visibility < 1) ||
    (ceiling != null && ceiling < 500)
  )
    return "LIFR";
  if (
    (visibility != null && visibility < 3) ||
    (ceiling != null && ceiling < 1000)
  )
    return "IFR";
  if (
    (visibility != null && visibility <= 5) ||
    (ceiling != null && ceiling <= 3000)
  )
    return "MVFR";
  if (
    visibility != null &&
    Number.isFinite(visibility) &&
    (ceiling !== null ||
      ["CLR", "SKC", "CAVOK", "NSC", "NCD"].includes(metar.cover ?? ""))
  )
    return "VFR";
  return null;
}
export function ceilingFeet(metar: Metar) {
  const ceiling = metar.clouds
    ?.filter(
      (cloud) =>
        ["BKN", "OVC", "VV"].includes(cloud.cover) && cloud.base != null,
    )
    .reduce((lowest, cloud) => Math.min(lowest, cloud.base!), Infinity);
  return ceiling == null || ceiling === Infinity ? null : ceiling;
}
export const weatherProvider = {
  async getMetar(station: string) {
    const reports = await providerRequest(
      "weather",
      `/api/data/metar?ids=${encodeURIComponent(station)}&format=json`,
      z.array(metarSchema),
      120000,
    );
    const report = reports.find((report) => report.icaoId === station);
    return report
      ? dataValue(
          report,
          "NOAA Aviation Weather Center",
          report.obsTime * 1000,
          Date.now(),
          "observed",
          5400,
        )
      : null;
  },
  async getTaf(station: string) {
    const reports = await providerRequest(
      "weather",
      `/api/data/taf?ids=${encodeURIComponent(station)}&format=json`,
      z.array(tafSchema),
      600000,
    );
    const report = reports.find((report) => report.icaoId === station);
    const issue = report
      ? typeof report.issueTime === "number"
        ? report.issueTime * 1000
        : Date.parse(report.issueTime)
      : null;
    return report
      ? dataValue(
          report,
          "NOAA Aviation Weather Center",
          issue !== null && Number.isFinite(issue) ? issue : null,
          Date.now(),
          "reported",
          12 * 3600,
        )
      : null;
  },
};
export async function stationWeather(station: string): Promise<StationWeather> {
  const [metar, taf] = await Promise.allSettled([
    weatherProvider.getMetar(station),
    weatherProvider.getTaf(station),
  ]);
  return {
    metar: metar.status === "fulfilled" ? metar.value : null,
    taf: taf.status === "fulfilled" ? taf.value : null,
    errors: [
      ...(metar.status === "rejected" ? ["METAR unavailable"] : []),
      ...(taf.status === "rejected" ? ["TAF unavailable"] : []),
    ],
  };
}
const position = z.array(z.number()).min(2).max(3);
const geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }),
  z.object({ type: z.literal("MultiPoint"), coordinates: z.array(position) }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(position) }),
  z.object({
    type: z.literal("MultiLineString"),
    coordinates: z.array(z.array(position)),
  }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(position)),
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(position))),
  }),
]);
export const weatherGeoSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      geometry,
      properties: z.record(z.string(), z.unknown()).nullable(),
    }),
  ),
});
export async function weatherOverlay(
  product: "sigmet" | "isigmet" | "gairmet" | "pirep",
  bounds?: [number, number, number, number],
) {
  const query = new URLSearchParams({ format: "geojson" });
  if (product === "pirep" && bounds) query.set("bbox", bounds.join(","));
  const response = await providerRequest(
    "weather",
    `/api/data/${product === "sigmet" ? "airsigmet" : product}?${query}`,
    z.union([
      weatherGeoSchema,
      z
        .array(z.never())
        .transform(() => ({
          type: "FeatureCollection" as const,
          features: [],
        })),
    ]),
    product === "gairmet" ? 600000 : 120000,
  );
  return dataValue(
    response as GeoJSON.FeatureCollection,
    "NOAA Aviation Weather Center",
    null,
    Date.now(),
    "reported",
    600,
  );
}
const bulkRowSchema = z
  .object({
    raw_text: z.string(),
    station_id: z.string(),
    observation_time: z.string(),
    latitude: z.string(),
    longitude: z.string(),
    flight_category: z.string().optional(),
  })
  .catchall(z.string());
let bulkCache: {
  expires: number;
  data: DataValue<GeoJSON.FeatureCollection>;
} | null = null;
let bulkPending: Promise<DataValue<GeoJSON.FeatureCollection>> | null = null;
export async function bulkMetars(): Promise<
  DataValue<GeoJSON.FeatureCollection>
> {
  if (bulkCache && bulkCache.expires > Date.now()) return bulkCache.data;
  if (bulkPending) return bulkPending;
  bulkPending = (async () => {
    const features = await providerRequest(
      "weather",
      "/data/cache/metars.cache.csv.gz",
      z.array(
        z.object({
          type: z.literal("Feature"),
          geometry: z.object({
            type: z.literal("Point"),
            coordinates: z.tuple([z.number(), z.number()]),
          }),
          properties: z.object({
            station: z.string(),
            category: z.string(),
            raw: z.string(),
            observedAt: z.number(),
          }),
        }),
      ),
      120000,
      {},
      async (response) => {
        const bytes = Buffer.from(await response.arrayBuffer());
        const text = (
          bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes
        ).toString("utf8");
        const start = text
          .split("\n")
          .findIndex(
            (line) =>
              line.startsWith("raw_text,") || line.startsWith('"raw_text",'),
          );
        if (start < 0) throw new Error("METAR cache header missing");
        const rows: unknown[] = parse(text, {
          columns: true,
          from_line: start + 1,
          skip_empty_lines: true,
          relax_column_count: false,
        });
        return rows.flatMap((row) => {
          const parsed = bulkRowSchema.safeParse(row);
          if (!parsed.success) return [];
          const report = parsed.data;
          const longitude = Number(report.longitude);
          const latitude = Number(report.latitude);
          const time = Date.parse(report.observation_time);
          if (
            !report.longitude ||
            !report.latitude ||
            !Number.isFinite(time) ||
            !Number.isFinite(longitude) ||
            !Number.isFinite(latitude) ||
            Math.abs(latitude) > 90 ||
            Math.abs(longitude) > 180
          )
            return [];
          return [
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [longitude, latitude],
              },
              properties: {
                station: report.station_id,
                category: report.flight_category || "Unknown",
                raw: report.raw_text,
                observedAt: time,
              },
            },
          ];
        });
      },
    );
    const data = dataValue<GeoJSON.FeatureCollection>(
      { type: "FeatureCollection", features },
      "NOAA AWC METAR cache",
      null,
      Date.now(),
      "observed",
      5400,
    );
    bulkCache = { expires: Date.now() + 120000, data };
    return data;
  })();
  try {
    return await bulkPending;
  } finally {
    bulkPending = null;
  }
}
