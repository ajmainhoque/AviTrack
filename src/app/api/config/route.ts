import { config, liveRefreshMs } from "@/lib/config/server";
export function GET() {
  return Response.json({
    provider: config.LIVE_PROVIDER,
    refreshMs: liveRefreshMs(),
    selectedRefreshMs: liveRefreshMs(true),
    global:
      config.GLOBAL_LIVE_MODE &&
      config.LIVE_PROVIDER === "adsbiq" &&
      config.ADSBIQ_GLOBAL_DISPLAY_AUTHORIZED,
    stream:
      config.LIVE_PROVIDER === "adsbiq" &&
      config.ADSBIQ_STREAM_ENABLED &&
      config.ADSBIQ_ACCESS_CONFIRMED &&
      config.ADSBIQ_TERMS_ACCEPTED &&
      Boolean(config.ADSBIQ_API_KEY),
    weather: config.WEATHER_OVERLAY,
    schedule: config.SCHEDULE_PROVIDER !== "none",
    notam: false,
    airspace: false,
    accounts: false,
    backgroundAlerts: false,
    historicalArchive: false,
  });
}
