"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import tzLookup from "tz-lookup";
import { apiFetch } from "@/lib/client/query";
import { useNow } from "@/lib/client/clock";
import { usePreferences } from "@/lib/client/store";
import { bearingDegrees, headingDifference } from "@/lib/aviation/calculations";
import { formatQuantity, formatTime } from "@/lib/aviation/units";
import type { AircraftState, Route } from "@/lib/aviation/model";
import type { Airport, AirportDetail } from "@/lib/aviation/reference";
import { StationWeatherView } from "../weather/station-weather";
export function RouteWeather({ route }: { route: Route }) {
  const now = useNow();
  return (
    <details className="route-weather">
      <summary>Origin & destination weather</summary>
      {[route.origin, route.destination].map((airport) => (
        <div key={airport.ident}>
          <p className="inline-note">
            {airport.name} /{" "}
            {now
              ? formatTime(
                  now,
                  tzLookup(airport.coordinate[1], airport.coordinate[0]),
                )
              : ""}{" "}
            local{" "}
            <span title="Time zone inferred from coordinates using tz-lookup">
              (inferred zone)
            </span>
          </p>
          {/^[A-Z0-9]{4}$/.test(airport.ident) ? (
            <StationWeatherView station={airport.ident} compact />
          ) : (
            <p className="inline-note">
              Weather station identifier not available.
            </p>
          )}
        </div>
      ))}
    </details>
  );
}
export function AirportProximity({
  aircraft,
  destination,
}: {
  aircraft: AircraftState;
  destination?: string;
}) {
  const position = aircraft.position?.value;
  const units = usePreferences((state) => state.units);
  const nearby = useQuery({
    queryKey: ["proximity", aircraft.id],
    queryFn: ({ signal }) =>
      apiFetch<{
        airports: (Airport & { distanceNm: number })[];
        source: string;
        syncedAt: number;
      }>(
        `/api/airports?lat=${position![1]}&lon=${position![0]}&radius=100`,
        signal,
      ),
    enabled: Boolean(position),
    staleTime: 60000,
    refetchInterval: 60000,
  });
  const airport = useQuery({
    queryKey: ["runway-context", destination],
    queryFn: ({ signal }) =>
      apiFetch<AirportDetail>(`/api/airports?code=${destination}`, signal),
    enabled: Boolean(
      destination &&
      typeof aircraft.altBaro?.value === "number" &&
      aircraft.altBaro.value < 10000,
    ),
    staleTime: 3600000,
  });
  const possibleRunways = airport.data?.runways
    .flatMap((runway) => [
      { ident: runway.le_ident, heading: runway.le_heading_degT },
      { ident: runway.he_ident, heading: runway.he_heading_degT },
    ])
    .filter(
      (end) =>
        end.heading != null &&
        aircraft.track != null &&
        Math.abs(headingDifference(aircraft.track.value, end.heading)) < 12 &&
        nearby.data?.airports.some(
          (item) => item.ident === destination && item.distanceNm < 10,
        ),
    );
  return (
    <section>
      <details>
        <summary>Nearby airport context</summary>
        <p className="inline-note">
          Inferred distances from the last position and OurAirports reference
          data. Not diversion recommendations.
        </p>
        <dl className="data-list">
          {nearby.data?.airports.slice(0, 3).map((airport) => (
            <div key={airport.ident}>
              <dt>
                <Link href={`/airport/${airport.ident}`}>
                  {airport.iata_code || airport.ident}
                </Link>
              </dt>
              <dd>
                {formatQuantity(airport.distanceNm, "distance", units)} /{" "}
                {position
                  ? `${bearingDegrees(position, [airport.longitude_deg, airport.latitude_deg]).toFixed(0)} deg`
                  : "N/A"}
              </dd>
            </div>
          ))}
        </dl>
        {possibleRunways?.length ? (
          <p className="inline-note">
            Possible runway alignment (inferred):{" "}
            {possibleRunways.map((runway) => runway.ident).join(", ")}. Not a
            confirmed landing runway.
          </p>
        ) : null}
        {nearby.error && (
          <p className="inline-note">Airport proximity unavailable.</p>
        )}
      </details>
    </section>
  );
}
