import { config } from "../../config/server";
import type { AircraftSnapshot } from "../../aviation/model";
import { ProviderError } from "../http";
import { AircraftDeltaStore } from "./delta";
type Subscriber = (snapshot: AircraftSnapshot) => void;
class SharedStream {
  listeners = new Set<Subscriber>();
  private store = new AircraftDeltaStore();
  private socket: WebSocket | null = null;
  private reconnect: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private latest: AircraftSnapshot | null = null;
  constructor(private zone: { lat: number; lon: number } | null) {}
  private connect() {
    this.reconnect = null;
    const url = new URL("wss://api.adsbiq.com/ws/");
    url.searchParams.set("token", config.ADSBIQ_API_KEY!);
    if (this.zone) {
      url.searchParams.set("lat", String(this.zone.lat));
      url.searchParams.set("lon", String(this.zone.lon));
    }
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      try {
        if (typeof event.data !== "string")
          throw new Error("Unsupported stream frame");
        const snapshot = this.store.apply(JSON.parse(event.data));
        snapshot.coverage = this.zone ? "regional" : "global";
        snapshot.refreshMs =
          config.ADSBIQ_TIER === "free" ? 150000 : this.zone ? 1000 : 10000;
        this.latest = snapshot;
        this.attempts = 0;
        for (const listener of this.listeners) listener(snapshot);
      } catch {
        this.store.reset();
        socket.close();
      }
    });
    socket.addEventListener("error", () => socket.close());
    socket.addEventListener("close", () => {
      this.store.reset();
      this.latest = null;
      this.socket = null;
      if (this.listeners.size) {
        const delay =
          Math.min(60000, 2000 * 2 ** Math.min(this.attempts++, 5)) +
          Math.random() * 1000;
        if (config.LOG_LEVEL === "debug")
          console.info(
            JSON.stringify({
              event: "stream.reconnect",
              provider: "adsbiq",
              delayMs: Math.round(delay),
            }),
          );
        this.reconnect = setTimeout(() => this.connect(), delay);
      }
    });
  }
  subscribe(listener: Subscriber) {
    this.listeners.add(listener);
    if (this.latest) listener(this.latest);
    if (!this.socket && !this.reconnect) this.connect();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        if (this.reconnect) clearTimeout(this.reconnect);
        this.reconnect = null;
        this.socket?.close();
        this.socket = null;
        this.latest = null;
        this.store.reset();
      }
    };
  }
}
const streams = new Map<string, SharedStream>();
export function subscribeAdsbIq(
  zone: { lat: number; lon: number } | null,
  listener: Subscriber,
) {
  if (
    !config.ADSBIQ_STREAM_ENABLED ||
    !config.ADSBIQ_API_KEY ||
    !config.ADSBIQ_TERMS_ACCEPTED ||
    !config.ADSBIQ_ACCESS_CONFIRMED
  )
    throw new ProviderError(
      "ADSBiq stream access is not authorized/configured",
      403,
    );
  if (
    !zone &&
    (!config.GLOBAL_LIVE_MODE || !config.ADSBIQ_GLOBAL_DISPLAY_AUTHORIZED)
  )
    throw new ProviderError(
      "Global feed display requires explicit provider authorization",
      403,
    );
  const key = zone
    ? `${Math.round(zone.lat)},${Math.round(zone.lon)}`
    : "global";
  if (!streams.has(key)) {
    for (const [id, stream] of streams)
      if (!stream.listeners.size) streams.delete(id);
    if (streams.size >= 3)
      throw new ProviderError("Stream capacity reached", 429, 60);
    streams.set(
      key,
      new SharedStream(
        zone ? { lat: Math.round(zone.lat), lon: Math.round(zone.lon) } : null,
      ),
    );
  }
  return streams.get(key)!.subscribe(listener);
}
