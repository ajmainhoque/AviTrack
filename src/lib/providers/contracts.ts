import type {
  AircraftMetadata,
  AircraftSnapshot,
  Airline,
  AirportReference,
  Coordinate,
  DataValue,
  Route,
  TrackPoint,
} from "../aviation/model";
export interface LiveAircraftProvider {
  id: string;
  getAircraftNear(
    lat: number,
    lon: number,
    radiusNm: number,
  ): Promise<AircraftSnapshot>;
  getAircraftByHex(hex: string): Promise<AircraftSnapshot>;
  getAircraftByRegistration(registration: string): Promise<AircraftSnapshot>;
  getAircraftByCallsign(callsign: string): Promise<AircraftSnapshot>;
  getAircraftByType(type: string): Promise<AircraftSnapshot>;
  getAircraftBySquawk(squawk: string): Promise<AircraftSnapshot>;
  getGlobalSnapshot?(): Promise<AircraftSnapshot>;
  openGlobalStream?(
    onSnapshot: (snapshot: AircraftSnapshot) => void,
  ): () => void;
  openZoneStream?(
    bounds: [number, number, number, number],
    onSnapshot: (snapshot: AircraftSnapshot) => void,
  ): () => void;
}
export interface AircraftMetadataProvider {
  getAircraft(identifier: string): Promise<DataValue<AircraftMetadata> | null>;
}
export interface RouteProvider {
  resolveCallsign(callsign: string): Promise<DataValue<Route> | null>;
  getAirline(code: string): Promise<DataValue<Airline[]> | null>;
}
export interface AirportProvider {
  search(query: string): Promise<DataValue<AirportReference[]>>;
  getAirport(code: string): Promise<DataValue<AirportReference> | null>;
}
export interface ScheduleRecord {
  flightNumber: string;
  marketingFlight: string | null;
  departureDelay: number | null;
  arrivalDelay: number | null;
  operatingFlight: string | null;
  date: string | null;
  registration: string | null;
  origin: string | null;
  destination: string | null;
  status: string | null;
  departure: {
    scheduled: string | null;
    estimated: string | null;
    actual: string | null;
    terminal: string | null;
    gate: string | null;
  };
  arrival: {
    scheduled: string | null;
    estimated: string | null;
    actual: string | null;
    terminal: string | null;
    gate: string | null;
    baggage: string | null;
  };
}
export interface ScheduleProvider {
  getFlight(
    identifier: string,
    explicit: boolean,
  ): Promise<DataValue<ScheduleRecord[]> | null>;
}
export interface WeatherProvider {
  getMetar(station: string): Promise<unknown>;
  getTaf(station: string): Promise<unknown>;
}
export interface AirspaceProvider {
  getAirspace(
    bounds: [number, number, number, number],
  ): Promise<DataValue<GeoJSON.FeatureCollection>>;
}
export interface NOTAMProvider {
  getAirportNotams(
    code: string,
  ): Promise<
    DataValue<{ raw: string; startsAt: string; endsAt: string | null }[]>
  >;
}
export interface HistoricalTrajectoryProvider {
  getTrack(flightId: string): Promise<TrackPoint[]>;
}
export type RouteReference = { origin: Coordinate; destination: Coordinate };
