import { config, liveRefreshMs } from "../../config/server";
import type { LiveAircraftProvider } from "../contracts";
import { ProviderError, providerRequest, responseReceivedAt, type ProviderId } from "../http";
import { normalizeReadsb, readsbSnapshotSchema } from "./readsb";

export class ReadsbProvider implements LiveAircraftProvider {
  constructor(public id: "adsblol" | "airplanes" | "adsbiq") {}
  private async query(path: string, selected = false) {
    if (
      this.id === "airplanes" &&
      (!config.NON_COMMERCIAL_USE || !config.AIRPLANES_TERMS_ACCEPTED)
    )
      throw new ProviderError(
        "Airplanes.live requires non-commercial use and terms confirmation",
        403,
      );
    if (
      this.id === "adsbiq" &&
      (!config.ADSBIQ_API_KEY ||
        !config.ADSBIQ_TERMS_ACCEPTED ||
        !config.ADSBIQ_ACCESS_CONFIRMED)
    )
      throw new ProviderError(
        "ADSBiq access and terms confirmation required",
        403,
      );
    const refresh =
      this.id === "adsbiq"
        ? config.ADSBIQ_TIER === "free"
          ? 300000
          : 20000
        : liveRefreshMs(selected);
    const headers: Record<string, string> =
      this.id === "adsbiq"
        ? { Authorization: `Bearer ${config.ADSBIQ_API_KEY}` }
        : {};
    const response = await providerRequest(
      this.id as ProviderId,
      path,
      readsbSnapshotSchema,
      Math.max(1500, refresh - 500),
      headers,
    );
    return normalizeReadsb(
      response,
      { adsblol: "ADSB.lol", airplanes: "Airplanes.live", adsbiq: "ADSBiq" }[
        this.id
      ],
      responseReceivedAt(response),
      refresh,
    );
  }
  getAircraftNear(lat: number, lon: number, radiusNm: number) {
    const radius = Math.min(250, Math.max(1, radiusNm));
    return this.query(
      this.id === "adsblol"
        ? `/v2/point/${lat}/${lon}/${radius}`
        : `/v2/lat/${lat}/lon/${lon}/dist/${radius}`,
    );
  }
  getAircraftByHex(hex: string) {
    return this.query(`/v2/hex/${encodeURIComponent(hex)}`, true);
  }
  getAircraftByRegistration(reg: string) {
    return this.query(`/v2/reg/${encodeURIComponent(reg)}`, true);
  }
  getAircraftByCallsign(callsign: string) {
    return this.query(`/v2/callsign/${encodeURIComponent(callsign)}`, true);
  }
  getAircraftByType(type: string) {
    return this.query(`/v2/type/${encodeURIComponent(type)}`);
  }
  getAircraftBySquawk(squawk: string) {
    return this.query(`/v2/squawk/${encodeURIComponent(squawk)}`);
  }
  async getGlobalSnapshot() {
    if (
      this.id !== "adsbiq" ||
      !config.GLOBAL_LIVE_MODE ||
      !config.ADSBIQ_GLOBAL_DISPLAY_AUTHORIZED
    )
      throw new ProviderError("Global live coverage is not configured", 400);
    return { ...(await this.query("/v2/all")), coverage: "global" as const };
  }
}
export async function withLiveProvider<T>(
  operation: (provider: LiveAircraftProvider) => Promise<T>,
): Promise<T> {
  const primary =
    config.LIVE_PROVIDER === "opensky"
      ? new (await import("./opensky")).OpenSkyProvider()
      : new ReadsbProvider(config.LIVE_PROVIDER);
  try {
    return await operation(primary);
  } catch (error) {
    if (
      config.FALLBACK_LIVE_PROVIDER === "none" ||
      config.FALLBACK_LIVE_PROVIDER === config.LIVE_PROVIDER ||
      (error instanceof ProviderError && error.status === 400)
    )
      throw error;
    return operation(new ReadsbProvider(config.FALLBACK_LIVE_PROVIDER));
  }
}
