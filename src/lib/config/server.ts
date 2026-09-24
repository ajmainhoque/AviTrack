import { z } from "zod";
const boolean = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");
export const config = z
  .object({
    LIVE_PROVIDER: z
      .enum(["adsblol", "airplanes", "adsbiq", "opensky"])
      .default("adsblol"),
    FALLBACK_LIVE_PROVIDER: z
      .enum(["none", "adsblol", "airplanes"])
      .default("none"),
    NON_COMMERCIAL_USE: boolean,
    AIRPLANES_TERMS_ACCEPTED: boolean,
    ADSBIQ_TERMS_ACCEPTED: boolean,
    ADSBIQ_ACCESS_CONFIRMED: boolean,
    ADSBIQ_GLOBAL_DISPLAY_AUTHORIZED: boolean,
    ADSBIQ_STREAM_ENABLED: boolean,
    OPENSKY_LICENSE_CONFIRMED: boolean,
    ADSBIQ_API_KEY: z.string().optional(),
    ADSBIQ_TIER: z.enum(["free", "contributor", "trial"]).default("free"),
    OPENSKY_CLIENT_ID: z.string().optional(),
    OPENSKY_CLIENT_SECRET: z.string().optional(),
    LIVE_REFRESH_MS: z.coerce.number().min(5000).default(5000),
    SELECTED_REFRESH_MS: z.coerce.number().min(2000).default(2500),
    GLOBAL_LIVE_MODE: boolean,
    WEATHER_OVERLAY: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    SCHEDULE_PROVIDER: z.enum(["none", "airlabs"]).default("none"),
    SCHEDULE_API_KEY: z.string().optional(),
    SCHEDULE_TERMS_ACCEPTED: boolean,
    SCHEDULE_MONTHLY_BUDGET: z.coerce.number().int().min(0).default(0),
    AIRSPACE_PROVIDER: z.enum(["none"]).default("none"),
    NOTAM_PROVIDER: z.enum(["none"]).default("none"),
    DATABASE_URL: z.string().optional(),
    LOG_LEVEL: z.enum(["silent", "error", "info", "debug"]).default("error"),
    TRUST_PROXY: boolean,
  })
  .parse(process.env);
export function liveRefreshMs(selected = false) {
  if (config.LIVE_PROVIDER === "adsbiq")
    return config.ADSBIQ_TIER === "free" ? 300000 : 20000;
  if (config.LIVE_PROVIDER === "opensky") return 60000;
  return selected ? config.SELECTED_REFRESH_MS : config.LIVE_REFRESH_MS;
}
