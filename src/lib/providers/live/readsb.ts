import { z } from "zod";
import {
  dataValue,
  type AircraftSnapshot,
  type AircraftState,
  type AviationScalar,
} from "../../aviation/model";

const optionalNumber = z.number().finite().nullish().catch(null);
const optionalText = z.string().nullish().catch(null);
export const readsbAircraftSchema = z
  .object({
    hex: z.string().min(1).max(32),
    type: optionalText,
    flight: optionalText,
    r: optionalText,
    t: optionalText,
    lat: z.number().min(-90).max(90).nullish(),
    lon: z.number().min(-180).max(180).nullish(),
    alt_baro: z
      .union([z.number().finite(), z.literal("ground")])
      .nullish()
      .catch(null),
    alt_geom: optionalNumber,
    gs: optionalNumber,
    track: optionalNumber,
    baro_rate: optionalNumber,
    squawk: optionalText,
    seen: optionalNumber,
    seen_pos: optionalNumber,
  })
  .catchall(z.unknown());
export const readsbSnapshotSchema = z
  .object({
    now: z.number().positive(),
    ac: z.array(z.unknown()).optional(),
    aircraft: z.array(z.unknown()).optional(),
  })
  .refine(
    (response) => response.ac !== undefined || response.aircraft !== undefined,
    "Missing aircraft array",
  );

const numericFields = new Set([
  "alt_geom",
  "gs",
  "ias",
  "tas",
  "mach",
  "track",
  "calc_track",
  "track_rate",
  "roll",
  "mag_heading",
  "true_heading",
  "baro_rate",
  "geom_rate",
  "nav_qnh",
  "nav_altitude_mcp",
  "nav_altitude_fms",
  "nav_heading",
  "nic",
  "nac_p",
  "nac_v",
  "sil",
  "sda",
  "gva",
  "rc",
  "nic_baro",
  "messages",
  "rssi",
  "version",
  "alert",
  "spi",
  "oat",
  "tat",
  "wd",
  "ws",
  "dbFlags",
  "seen",
  "seen_pos",
]);
const textFields = new Set([
  "flight",
  "r",
  "t",
  "desc",
  "ownOp",
  "type",
  "squawk",
  "emergency",
  "category",
  "sil_type",
]);
const arrayFields = new Set(["mlat", "tisb", "nav_modes"]);
export function normalizeReadsb(
  input: unknown,
  source: string,
  receivedAt = Date.now(),
  refreshMs = 5000,
): AircraftSnapshot {
  const response = readsbSnapshotSchema.parse(input);
  const snapshotAt = response.now > 1e12 ? response.now : response.now * 1000;
  const aircraft: AircraftState[] = [];
  let rejected = 0;
  for (const entry of response.ac ?? response.aircraft ?? []) {
    const parsed = readsbAircraftSchema.safeParse(entry);
    if (!parsed.success) {
      rejected++;
      continue;
    }
    const raw = parsed.data;
    const messageAt =
      raw.seen == null ? null : snapshotAt - Math.max(0, raw.seen) * 1000;
    const positionAt =
      raw.seen_pos == null
        ? null
        : snapshotAt - Math.max(0, raw.seen_pos) * 1000;
    const observed = <T>(
      value: T | null | undefined,
      kind: "observed" | "enriched" = "observed",
    ) =>
      value == null
        ? null
        : dataValue(
            value,
            source,
            kind === "enriched" ? null : messageAt,
            receivedAt,
            kind,
          );
    const fields: AircraftState["fields"] = {};
    for (const [key, value] of Object.entries(raw)) {
      if (
        (numericFields.has(key) &&
          typeof value === "number" &&
          Number.isFinite(value)) ||
        (textFields.has(key) && typeof value === "string") ||
        (arrayFields.has(key) &&
          Array.isArray(value) &&
          value.every((item) => typeof item === "string"))
      ) {
        fields[key] = dataValue(
          value as AviationScalar,
          source,
          ["r", "t", "desc", "ownOp", "dbFlags"].includes(key)
            ? null
            : messageAt,
          receivedAt,
          ["r", "t", "desc", "ownOp", "dbFlags"].includes(key)
            ? "enriched"
            : "observed",
        );
      }
    }
    aircraft.push({
      id: raw.hex.toLowerCase(),
      source,
      receivedAt,
      messageAt,
      position:
        raw.lat != null && raw.lon != null
          ? dataValue([raw.lon, raw.lat], source, positionAt, receivedAt)
          : null,
      callsign: observed(raw.flight?.trim() || null),
      registration: observed(raw.r, "enriched"),
      aircraftType: observed(raw.t, "enriched"),
      altBaro: observed(raw.alt_baro),
      altGeom: observed(raw.alt_geom),
      groundSpeed: observed(raw.gs),
      track: observed(raw.track),
      verticalRate: observed(raw.baro_rate),
      squawk: observed(raw.squawk),
      positionSource:
        Array.isArray(raw.mlat) && raw.mlat.includes("lat")
          ? "MLAT"
          : Array.isArray(raw.tisb) && raw.tisb.includes("lat")
            ? "TIS-B"
            : (raw.type ?? "unknown"),
      fields,
    });
  }
  return {
    aircraft,
    source,
    receivedAt,
    refreshMs,
    coverage: "regional",
    rejected,
  };
}
