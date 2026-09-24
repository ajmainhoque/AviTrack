import { z } from "zod";
import { config } from "../../config/server";
import type { LiveAircraftProvider } from "../contracts";
import { ProviderError, providerRequest } from "../http";
import { normalizeReadsb } from "./readsb";
const scalar = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.number()),
  z.null(),
]);
const schema = z.object({
  time: z.number(),
  states: z.array(z.array(scalar)).nullable(),
});
let token: { value: string; expiresAt: number } | null = null;
async function authorization(): Promise<Record<string, string>> {
  if (!config.OPENSKY_LICENSE_CONFIRMED)
    throw new ProviderError("OpenSky license confirmation required", 403);
  if (!config.OPENSKY_CLIENT_ID || !config.OPENSKY_CLIENT_SECRET) return {};
  if (!token || token.expiresAt < Date.now()) {
    const response = await fetch(
      "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
      {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.OPENSKY_CLIENT_ID,
          client_secret: config.OPENSKY_CLIENT_SECRET,
        }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new ProviderError("OpenSky authentication unavailable", 503);
    const parsed = z
      .object({ access_token: z.string(), expires_in: z.number() })
      .parse(await response.json());
    token = {
      value: parsed.access_token,
      expiresAt: Date.now() + (parsed.expires_in - 60) * 1000,
    };
  }
  return { Authorization: `Bearer ${token.value}` };
}
export class OpenSkyProvider implements LiveAircraftProvider {
  id = "opensky";
  private async query(query: string) {
    const response = await providerRequest(
      "opensky",
      `/states/all?${query}`,
      schema,
      60000,
      await authorization(),
    );
    const aircraft = (response.states ?? []).map((row) => ({
      hex: row[0],
      flight: row[1],
      lon: row[5],
      lat: row[6],
      alt_baro:
        row[8] === true
          ? "ground"
          : typeof row[7] === "number"
            ? row[7] / 0.3048
            : null,
      gs: typeof row[9] === "number" ? row[9] * 1.943844 : null,
      track: row[10],
      baro_rate: typeof row[11] === "number" ? row[11] / 0.00508 : null,
      alt_geom: typeof row[13] === "number" ? row[13] / 0.3048 : null,
      squawk: row[14],
      type: row[16] === 2 ? "mlat" : "adsb_icao",
      seen_pos: typeof row[3] === "number" ? response.time - row[3] : null,
      seen: typeof row[4] === "number" ? response.time - row[4] : null,
    }));
    return normalizeReadsb(
      { now: response.time, ac: aircraft },
      "OpenSky",
      Date.now(),
      60000,
    );
  }
  getAircraftNear(lat: number, lon: number, radius: number) {
    const delta = Math.min(radius, 250) / 60;
    const longitudeDelta = Math.min(
      180,
      delta / Math.max(0.1, Math.cos((lat * Math.PI) / 180)),
    );
    return this.query(
      new URLSearchParams({
        lamin: String(Math.max(-90, lat - delta)),
        lamax: String(Math.min(90, lat + delta)),
        lomin: String(Math.max(-180, lon - longitudeDelta)),
        lomax: String(Math.min(180, lon + longitudeDelta)),
      }).toString(),
    );
  }
  getAircraftByHex(hex: string) {
    return this.query(`icao24=${encodeURIComponent(hex)}`);
  }
  private unsupported(): never {
    throw new ProviderError("This lookup is not supported by OpenSky", 400);
  }
  getAircraftByRegistration(): never {
    return this.unsupported();
  }
  getAircraftByCallsign(): never {
    return this.unsupported();
  }
  getAircraftByType(): never {
    return this.unsupported();
  }
  getAircraftBySquawk(): never {
    return this.unsupported();
  }
}
