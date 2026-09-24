"use client";
import Dexie, { type EntityTable } from "dexie";
import type { AircraftState, TrackPoint } from "../aviation/model";
import { compressTrack, plausiblePosition } from "../aviation/calculations";
const database = new Dexie("avitrack-local") as Dexie & {
  tracks: EntityTable<
    {
      flightId: string;
      aircraftId: string;
      updatedAt: number;
      bookmarked: boolean;
      points: TrackPoint[];
    },
    "flightId"
  >;
};
database
  .version(1)
  .stores({ tracks: "flightId, aircraftId, updatedAt, bookmarked" });
export function observation(aircraft: AircraftState): TrackPoint | null {
  if (!aircraft.position || aircraft.position.observedAt === null) return null;
  return {
    id: aircraft.id,
    flightId: `${aircraft.id}:${aircraft.callsign?.value ?? "unknown"}`,
    timestamp: aircraft.position.observedAt,
    coordinate: aircraft.position.value,
    altitude: aircraft.altBaro?.value ?? null,
    geometricAltitude: aircraft.altGeom?.value ?? null,
    speed: aircraft.groundSpeed?.value ?? null,
    verticalRate: aircraft.verticalRate?.value ?? null,
    track: aircraft.track?.value ?? null,
    source: aircraft.source,
    fields: aircraft.fields,
  };
}
export function appendObservation(points: TrackPoint[], next: TrackPoint) {
  const previous = points.at(-1);
  const base = next.flightId.split(":").slice(0, 2).join(":");
  if (
    !previous ||
    previous.flightId.split(":").slice(0, 2).join(":") !== base ||
    next.timestamp - previous.timestamp > 30 * 60000
  )
    return [
      { ...next, flightId: `${base}:${Math.floor(next.timestamp / 1000)}` },
    ];
  if (previous && !plausiblePosition(previous, next)) return points;
  return compressTrack([...points, { ...next, flightId: previous.flightId }]);
}
export async function saveTrack(points: TrackPoint[], bookmarked = false) {
  const latest = points.at(-1);
  if (!latest) return;
  await database.tracks.put({
    flightId: latest.flightId,
    aircraftId: latest.id,
    updatedAt: latest.timestamp,
    bookmarked,
    points,
  });
  const expired = await database.tracks
    .where("updatedAt")
    .below(Date.now() - 7 * 86400000)
    .toArray();
  await database.tracks.bulkDelete(
    expired.filter((track) => !track.bookmarked).map((track) => track.flightId),
  );
  const overflow = await database.tracks
    .orderBy("updatedAt")
    .reverse()
    .offset(50)
    .toArray();
  await database.tracks.bulkDelete(overflow.map((track) => track.flightId));
}
export async function loadTracks(id: string) {
  return (await database.tracks.where("aircraftId").equals(id).toArray()).sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}
export const clearTracks = () => database.tracks.clear();
