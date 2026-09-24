"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Heart, Plane, Radio } from "lucide-react";
import { apiFetch } from "@/lib/client/query";
import { loadTracks } from "@/lib/client/history";
import { usePreferences, useTracker } from "@/lib/client/store";
import type {
  AircraftMetadata,
  AircraftSnapshot,
  DataValue,
  TrackPoint,
} from "@/lib/aviation/model";
import { formatAltitude, formatQuantity } from "@/lib/aviation/units";
import dynamic from "next/dynamic";
const TrackCharts = dynamic(() => import("../charts/track-charts"), {
  ssr: false,
});
export function AircraftReference({ identifier }: { identifier: string }) {
  const preferences = usePreferences();
  const [tracks, setTracks] = useState<
    { flightId: string; points: TrackPoint[]; updatedAt: number }[]
  >([]);
  const [replay, setReplay] = useState(false);
  const metadata = useQuery({
    queryKey: ["metadata", identifier],
    queryFn: ({ signal }) =>
      apiFetch<{ data: DataValue<AircraftMetadata> | null }>(
        `/api/enrichment?id=${encodeURIComponent(identifier)}`,
        signal,
      ),
    staleTime: 86400000,
  });
  const hex = /^~?[a-f0-9]{6}$/i.test(identifier)
    ? identifier.toLowerCase()
    : metadata.data?.data?.value.hex.toLowerCase();
  const live = useQuery({
    queryKey: ["aircraft-reference", identifier],
    queryFn: ({ signal }) =>
      apiFetch<AircraftSnapshot>(
        `/api/live?id=${encodeURIComponent(identifier)}&kind=${/^~?[a-f0-9]{6}$/i.test(identifier) ? "hex" : "registration"}`,
        signal,
      ),
    staleTime: 10000,
    refetchInterval: 30000,
  });
  useEffect(() => {
    let active = true;
    if (hex)
      loadTracks(hex)
        .then((result) => {
          if (active) setTracks(result);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [hex]);
  const details = metadata.data?.data;
  const current = live.data?.aircraft[0];
  const favorite = preferences.favorites.some(
    (entry) => entry.id === (hex || identifier),
  );
  return (
    <>
      <div className="eyebrow">AIRCRAFT REFERENCE</div>
      <div className="airport-heading">
        <div>
          <h1>{details?.value.registration || identifier.toUpperCase()}</h1>
          <p className="inline-note">
            {details?.value.manufacturer || "Manufacturer unavailable"} /{" "}
            {details?.value.model || "Model unavailable"}
          </p>
        </div>
        <Plane size={58} strokeWidth={1} color="var(--accent)" />
      </div>
      <div className="privacy-actions">
        <Link className="button primary" href={`/flight/${hex || identifier}`}>
          <Radio size={15} />
          Open live tracking
        </Link>
        <button
          className="button"
          onClick={() =>
            preferences.toggleFavorite({
              id: hex || identifier,
              label: details?.value.registration || identifier,
              type: "aircraft",
            })
          }
        >
          <Heart size={15} fill={favorite ? "currentColor" : "none"} />
          {favorite ? "Saved" : "Save aircraft"}
        </button>
      </div>
      <div className="reference-grid">
        <section>
          <h2>Identity & airframe</h2>
          <dl className="data-list">
            {Object.entries({
              Registration: details?.value.registration,
              "Mode-S / target ID": hex,
              Manufacturer: details?.value.manufacturer,
              Model: details?.value.model,
              "ICAO type": details?.value.type,
              Owner: details?.value.owner,
              Country: details?.value.country,
            }).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value || "Not available"}</dd>
              </div>
            ))}
          </dl>
          <p className="inline-note">
            {details
              ? `${details.source} / enriched / retrieved ${new Date(details.receivedAt).toISOString()}`
              : "Aircraft metadata not available."}
          </p>
          <p className="inline-note">No licensed photograph is configured.</p>
        </section>
        <section>
          <h2>Current observation</h2>
          {current ? (
            <>
              <dl className="data-list">
                <div>
                  <dt>Callsign</dt>
                  <dd>{current.callsign?.value || "Not available"}</dd>
                </div>
                <div>
                  <dt>Barometric altitude</dt>
                  <dd>
                    {formatAltitude(current.altBaro?.value, preferences.units)}
                  </dd>
                </div>
                <div>
                  <dt>Groundspeed</dt>
                  <dd>
                    {formatQuantity(
                      current.groundSpeed?.value,
                      "speed",
                      preferences.units,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Position source</dt>
                  <dd>{current.positionSource}</dd>
                </div>
              </dl>
              <p className="inline-note">
                {current.source} / observed{" "}
                {current.position?.observedAt
                  ? new Date(current.position.observedAt).toISOString()
                  : "at an unknown time"}
              </p>
            </>
          ) : (
            <p>
              {live.isFetching
                ? "Checking the live provider..."
                : "No current live state available. This does not confirm that the aircraft is on the ground."}
            </p>
          )}
        </section>
      </div>
      <section>
        <h2>Locally retained trajectories</h2>
        <p>
          Only observations captured on this device. Not complete global flight
          history.
        </p>
        {tracks.length ? (
          tracks.map((track) => (
            <p key={track.flightId}>
              <button
                className="button"
                onClick={() => {
                  useTracker.setState({
                    trail: track.points,
                    playbackTime: track.points[0]?.timestamp ?? null,
                  });
                  setReplay(true);
                }}
              >
                {new Date(track.updatedAt).toISOString()} /{" "}
                {track.points.length} observations
              </button>
            </p>
          ))
        ) : (
          <p>No locally retained tracks.</p>
        )}
        {replay && (
          <div style={{ maxWidth: 650 }}>
            <TrackCharts />
          </div>
        )}
      </section>
    </>
  );
}
