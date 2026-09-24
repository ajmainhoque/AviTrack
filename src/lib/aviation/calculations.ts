import { bearing, destination, distance, greatCircle } from "@turf/turf";
import type { AircraftState, Coordinate, TrackPoint } from "./model";

export const distanceNm = (from: Coordinate, to: Coordinate) =>
  distance(from, to, { units: "nauticalmiles" });
export const bearingDegrees = (from: Coordinate, to: Coordinate) =>
  (bearing(from, to) + 360) % 360;
export const destinationPoint = (
  from: Coordinate,
  heading: number,
  nauticalMiles: number,
) =>
  destination(from, nauticalMiles, heading, { units: "nauticalmiles" }).geometry
    .coordinates as Coordinate;
export const headingDifference = (from: number, to: number) =>
  ((to - from + 540) % 360) - 180;
export function interpolatePosition(
  from: Coordinate,
  to: Coordinate,
  fraction: number,
): Coordinate {
  if (fraction <= 0) return from;
  if (fraction >= 1) return to;
  return destinationPoint(
    from,
    bearingDegrees(from, to),
    distanceNm(from, to) * fraction,
  );
}
export function freshness(
  observedAt: number | null,
  now = Date.now(),
  refreshMs = 5000,
) {
  if (observedAt === null) return "unknown";
  const age = (now - observedAt) / 1000;
  const cadence = refreshMs / 1000;
  return age <= Math.max(15, cadence * 1.5)
    ? "live"
    : age <= Math.max(30, cadence * 2)
      ? "delayed"
      : age <= Math.max(120, cadence * 3)
        ? "stale"
        : "lost";
}
export function emergency(
  squawk: string | null,
  explicit: string | null = null,
): string | null {
  if (squawk && ["7500", "7600", "7700"].includes(squawk))
    return `Transponder reports ${squawk}`;
  if (
    explicit &&
    !["none", "no emergency", "0"].includes(explicit.toLowerCase())
  )
    return `Transponder reports ${explicit}`;
  return null;
}
export function plausiblePosition(previous: TrackPoint, next: TrackPoint) {
  const seconds = (next.timestamp - previous.timestamp) / 1000;
  if (seconds <= 0) return false;
  return (
    distanceNm(previous.coordinate, next.coordinate) <=
    0.15 + (seconds / 3600) * 2500
  );
}
export function splitAntimeridian(coordinates: Coordinate[]): Coordinate[][] {
  if (!coordinates.length) return [];
  const segments: Coordinate[][] = [[coordinates[0]]];
  for (let index = 1; index < coordinates.length; index++) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    if (Math.abs(current[0] - previous[0]) > 180) {
      const unwrapped = current[0] + (previous[0] > 0 ? 360 : -360);
      const boundary = previous[0] > 0 ? 180 : -180;
      const ratio = (boundary - previous[0]) / (unwrapped - previous[0]);
      const crossing = interpolatePosition(previous, current, ratio);
      segments[segments.length - 1].push([boundary, crossing[1]]);
      segments.push([[-boundary, crossing[1]], current]);
    } else segments[segments.length - 1].push(current);
  }
  return segments.filter((segment) => segment.length > 1);
}
export function directRoute(from: Coordinate, to: Coordinate) {
  return greatCircle(from, to, { npoints: 100 });
}
export function estimateProgress(
  aircraft: AircraftState,
  origin: Coordinate,
  destination: Coordinate,
  now = Date.now(),
) {
  if (!aircraft.position) return null;
  const total = distanceNm(origin, destination);
  const remaining = distanceNm(aircraft.position.value, destination);
  const fromOrigin = distanceNm(origin, aircraft.position.value);
  const speed = aircraft.groundSpeed?.value ?? 0;
  const heading = aircraft.track?.value;
  const meaningful =
    aircraft.altBaro?.value !== "ground" &&
    speed >= 80 &&
    freshness(aircraft.position.observedAt, now) === "live" &&
    heading != null &&
    Math.abs(
      headingDifference(
        heading,
        bearingDegrees(aircraft.position.value, destination),
      ),
    ) < 75 &&
    remaining > 5 &&
    total > 5;
  return {
    total,
    remaining,
    fromOrigin,
    progress: total > 0 ? Math.max(0, Math.min(1, 1 - remaining / total)) : 0,
    etaMinutes: meaningful ? (remaining / speed) * 60 : null,
  };
}
export function projectedTrack(
  aircraft: AircraftState,
  now = Date.now(),
): Coordinate[] {
  if (
    !aircraft.position ||
    aircraft.altBaro?.value === "ground" ||
    freshness(aircraft.position.observedAt, now) !== "live" ||
    aircraft.groundSpeed == null ||
    aircraft.track == null
  )
    return [];
  const turn = aircraft.fields.track_rate?.value;
  if (typeof turn === "number" && Math.abs(turn) > 0.3) return [];
  return [0, 5, 10, 20].map((minutes) =>
    destinationPoint(
      aircraft.position!.value,
      aircraft.track!.value,
      (aircraft.groundSpeed!.value * minutes) / 60,
    ),
  );
}
export function compressTrack(points: TrackPoint[], max = 3600): TrackPoint[] {
  if (points.length <= 2) return points;
  const output = [points[0]];
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const previous = output[output.length - 1];
    const next = points[index + 1];
    const turning =
      point.track != null &&
      previous.track != null &&
      Math.abs(headingDifference(previous.track, point.track)) > 3;
    const altitudeChange =
      point.altitude !== previous.altitude &&
      (typeof point.altitude !== "number" ||
        typeof previous.altitude !== "number" ||
        Math.abs(point.altitude - previous.altitude) >= 100);
    if (
      turning ||
      altitudeChange ||
      Math.abs((point.speed ?? 0) - (previous.speed ?? 0)) >= 10 ||
      point.timestamp - previous.timestamp >= 15000 ||
      next.timestamp - point.timestamp > 30000
    )
      output.push(point);
  }
  output.push(points[points.length - 1]);
  return output.slice(-max);
}
export type FlightPhase =
  "parked" | "taxi" | "climb" | "cruise" | "descent" | "unknown";
export function inferPhase(points: TrackPoint[]): FlightPhase {
  if (points.length < 3) return "unknown";
  const latest = points[points.length - 1];
  const recent = points.filter(
    (point) => latest.timestamp - point.timestamp <= 30000,
  );
  if (recent.length < 3 || latest.timestamp - recent[0].timestamp < 10000)
    return "unknown";
  const candidates = recent.map((point): FlightPhase => {
    if (point.altitude === "ground")
      return point.speed == null
        ? "unknown"
        : point.speed < 3
          ? "parked"
          : "taxi";
    if (point.verticalRate == null || point.altitude == null) return "unknown";
    if (point.verticalRate > 350) return "climb";
    if (point.verticalRate < -350) return "descent";
    return typeof point.altitude === "number" &&
      point.altitude > 18000 &&
      Math.abs(point.verticalRate) < 200
      ? "cruise"
      : "unknown";
  });
  const latestPhase = candidates[candidates.length - 1];
  return candidates.filter((phase) => phase === latestPhase).length /
    candidates.length >=
    0.8
    ? latestPhase
    : "unknown";
}
