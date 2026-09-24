export type DataKind =
  "observed" | "reported" | "enriched" | "inferred" | "estimated";
export interface DataValue<T> {
  value: T;
  source: string;
  observedAt: number | null;
  receivedAt: number;
  ageSeconds: number | null;
  kind: DataKind;
  confidence: "high" | "medium" | "low" | "unknown";
  isStale: boolean;
}
export function dataValue<T>(
  value: T,
  source: string,
  observedAt: number | null,
  receivedAt: number,
  kind: DataKind = "observed",
  staleAfter = 30,
): DataValue<T> {
  const ageSeconds =
    observedAt === null ? null : Math.max(0, (receivedAt - observedAt) / 1000);
  return {
    value,
    source,
    observedAt,
    receivedAt,
    ageSeconds,
    kind,
    confidence: "unknown",
    isStale: ageSeconds !== null && ageSeconds > staleAfter,
  };
}
export type Altitude = number | "ground";
export type AviationScalar = string | number | boolean | string[];
export type Coordinate = [number, number];
export interface AircraftState {
  id: string;
  source: string;
  receivedAt: number;
  messageAt: number | null;
  position: DataValue<Coordinate> | null;
  callsign: DataValue<string> | null;
  registration: DataValue<string> | null;
  aircraftType: DataValue<string> | null;
  altBaro: DataValue<Altitude> | null;
  altGeom: DataValue<number> | null;
  groundSpeed: DataValue<number> | null;
  track: DataValue<number> | null;
  verticalRate: DataValue<number> | null;
  squawk: DataValue<string> | null;
  positionSource: string;
  fields: Record<string, DataValue<AviationScalar>>;
}
export interface AircraftSnapshot {
  aircraft: AircraftState[];
  source: string;
  receivedAt: number;
  refreshMs: number;
  coverage: "regional" | "global";
  rejected: number;
}
export interface TrackPoint {
  id: string;
  flightId: string;
  timestamp: number;
  coordinate: Coordinate;
  altitude: Altitude | null;
  geometricAltitude: number | null;
  speed: number | null;
  verticalRate: number | null;
  track: number | null;
  source: string;
  fields: AircraftState["fields"];
}
export interface AirportReference {
  ident: string;
  name: string;
  iata: string | null;
  coordinate: Coordinate;
  municipality: string | null;
  country: string | null;
}
export interface Airline {
  name: string;
  icao: string;
  iata: string | null;
  country: string;
  callsign: string | null;
}
export interface Route {
  callsign: string;
  callsignIcao: string | null;
  callsignIata: string | null;
  airline: Airline | null;
  origin: AirportReference;
  destination: AirportReference;
  midpoint: AirportReference | null;
  filedRoute?: Coordinate[];
}
export interface AircraftMetadata {
  registration: string;
  hex: string;
  manufacturer: string;
  model: string;
  type: string;
  owner: string;
  country: string;
}
