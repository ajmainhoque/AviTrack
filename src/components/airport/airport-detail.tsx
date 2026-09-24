"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import * as maplibre from "maplibre-gl";
import { featureCollection, lineString, point } from "@turf/turf";
import { Heart, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AirportDetail } from "@/lib/aviation/reference";
import type { AircraftSnapshot } from "@/lib/aviation/model";
import { usePreferences } from "@/lib/client/store";
import { useNow } from "@/lib/client/clock";
import { apiFetch } from "@/lib/client/query";
import {
  formatQuantity,
  formatTime,
  formatAltitude,
} from "@/lib/aviation/units";
import { StationWeatherView } from "../weather/station-weather";
import { AirportSchedules } from "../flight/schedule-section";
export function AirportDetailView({ detail }: { detail: AirportDetail }) {
  const { airport } = detail;
  const preferences = usePreferences();
  const now = useNow();
  const container = useRef<HTMLDivElement>(null);
  const traffic = useQuery({
    queryKey: ["airport-traffic", airport.ident],
    queryFn: ({ signal }) =>
      apiFetch<AircraftSnapshot>(
        `/api/live?lat=${airport.latitude_deg}&lon=${airport.longitude_deg}&radius=25`,
        signal,
      ),
    staleTime: 15000,
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (!container.current) return;
    maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const map = new maplibre.Map({
      container: container.current,
      style:
        process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
        "https://tiles.openfreemap.org/styles/positron",
      center: [airport.longitude_deg, airport.latitude_deg],
      zoom: 12,
      attributionControl: {
        compact: true,
        customAttribution: "OurAirports (Public Domain)",
      },
    });
    map.addControl(new maplibre.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("runways", {
        type: "geojson",
        data: featureCollection(
          detail.runways.flatMap((runway) =>
            runway.le_longitude_deg != null &&
            runway.le_latitude_deg != null &&
            runway.he_longitude_deg != null &&
            runway.he_latitude_deg != null
              ? [
                  lineString(
                    [
                      [runway.le_longitude_deg, runway.le_latitude_deg],
                      [runway.he_longitude_deg, runway.he_latitude_deg],
                    ],
                    {
                      label: `${runway.le_ident ?? "?"} / ${runway.he_ident ?? "?"}`,
                      closed: runway.closed,
                    },
                  ),
                ]
              : [],
          ),
        ),
      });
      map.addLayer({
        id: "runway-lines",
        type: "line",
        source: "runways",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "closed"], true],
            "#b25858",
            "#007e78",
          ],
          "line-width": 5,
        },
      });
      map.addLayer({
        id: "runway-labels",
        type: "symbol",
        source: "runways",
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-offset": [0, -1],
        },
        paint: {
          "text-color": "#173e3a",
          "text-halo-color": "#fff",
          "text-halo-width": 2,
        },
      });
      map.addSource("airport", {
        type: "geojson",
        data: point([airport.longitude_deg, airport.latitude_deg]),
      });
      map.addLayer({
        id: "airport-point",
        type: "circle",
        source: "airport",
        paint: {
          "circle-radius": 5,
          "circle-color": "#c76c2e",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
    });
    return () => map.remove();
  }, [airport.latitude_deg, airport.longitude_deg, detail.runways]);
  const favorite = preferences.favorites.some(
    (entry) => entry.type === "airport" && entry.id === airport.ident,
  );
  const station =
    airport.icao_code ||
    (airport.gps_code?.length === 4
      ? airport.gps_code
      : airport.ident.length === 4
        ? airport.ident
        : null);
  return (
    <>
      <div className="eyebrow">AIRPORT REFERENCE</div>
      <div className="airport-heading">
        <div>
          <h1>{airport.name}</h1>
          <div className="airport-codes">
            <span>{airport.iata_code || "No IATA code"}</span>
            <span>{airport.icao_code || airport.ident}</span>
            <span>{detail.countryName || airport.iso_country}</span>
          </div>
        </div>
        <button
          className="button"
          onClick={() =>
            preferences.toggleFavorite({
              id: airport.ident,
              label: airport.name,
              type: "airport",
            })
          }
        >
          <Heart size={15} fill={favorite ? "currentColor" : "none"} />
          {favorite ? "Saved" : "Save"}
        </button>
      </div>
      <p
        className="inline-note"
        title={`enriched | OurAirports | source sync ${new Date(detail.syncedAt).toISOString()} | individual record observation date not supplied`}
      >
        OurAirports / Public Domain / synchronized{" "}
        {new Date(detail.syncedAt).toISOString().slice(0, 10)}
      </p>
      <div className="reference-grid">
        <div>
          <section>
            <div
              ref={container}
              className="reference-map"
              role="region"
              aria-label="Airport and runway map"
            />
            <div className="section-heading" style={{ marginTop: 14 }}>
              <span className="small-mono">
                {airport.latitude_deg.toFixed(5)},{" "}
                {airport.longitude_deg.toFixed(5)}
              </span>
              <Link
                className="button"
                href={`/map?lat=${airport.latitude_deg}&lon=${airport.longitude_deg}&zoom=11`}
              >
                <MapPin size={14} />
                Live airspace
              </Link>
            </div>
          </section>
          <section>
            <h2>Runways</h2>
            {detail.runways.length ? (
              detail.runways.map((runway) => (
                <details key={runway.id} open>
                  <summary>
                    <strong>
                      {runway.le_ident || "?"} / {runway.he_ident || "?"}
                    </strong>{" "}
                    /{" "}
                    {formatQuantity(
                      runway.length_ft,
                      "altitude",
                      preferences.units,
                    )}{" "}
                    x{" "}
                    {formatQuantity(
                      runway.width_ft,
                      "altitude",
                      preferences.units,
                    )}{" "}
                    / {runway.surface || "Surface unavailable"}
                    {runway.closed ? " / Closed" : ""}
                  </summary>
                  <dl className="data-list">
                    <div>
                      <dt>Lighting</dt>
                      <dd>
                        {runway.lighted === null
                          ? "Not available"
                          : runway.lighted
                            ? "Lighted"
                            : "Not lighted"}
                      </dd>
                    </div>
                    <div>
                      <dt>True headings</dt>
                      <dd>
                        {runway.le_heading_degT ?? "N/A"} /{" "}
                        {runway.he_heading_degT ?? "N/A"} deg
                      </dd>
                    </div>
                    <div>
                      <dt>Low end coordinates</dt>
                      <dd>
                        {runway.le_latitude_deg ?? "N/A"},{" "}
                        {runway.le_longitude_deg ?? "N/A"}
                      </dd>
                    </div>
                    <div>
                      <dt>High end coordinates</dt>
                      <dd>
                        {runway.he_latitude_deg ?? "N/A"},{" "}
                        {runway.he_longitude_deg ?? "N/A"}
                      </dd>
                    </div>
                    <div>
                      <dt>Displaced thresholds</dt>
                      <dd>
                        {formatQuantity(
                          runway.le_displaced_threshold_ft,
                          "altitude",
                          preferences.units,
                        )}{" "}
                        /{" "}
                        {formatQuantity(
                          runway.he_displaced_threshold_ft,
                          "altitude",
                          preferences.units,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>End elevations</dt>
                      <dd>
                        {formatQuantity(
                          runway.le_elevation_ft,
                          "altitude",
                          preferences.units,
                        )}{" "}
                        /{" "}
                        {formatQuantity(
                          runway.he_elevation_ft,
                          "altitude",
                          preferences.units,
                        )}
                      </dd>
                    </div>
                  </dl>
                </details>
              ))
            ) : (
              <p>No runway records available.</p>
            )}
          </section>
          <section>
            <h2>Radio frequencies</h2>
            {detail.frequencies.length ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.frequencies.map((frequency) => (
                      <tr key={frequency.id}>
                        <td>{frequency.type}</td>
                        <td>{frequency.description || "Not available"}</td>
                        <td>{frequency.frequency_mhz.toFixed(3)} MHz</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No frequency records available.</p>
            )}
          </section>
          <section>
            <h2>Nearby navaids</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Ident</th>
                    <th>Name / type</th>
                    <th>Frequency</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.navaids.map((navaid) => (
                    <tr key={navaid.id}>
                      <td>{navaid.ident}</td>
                      <td>
                        {navaid.name} / {navaid.type}
                      </td>
                      <td>
                        {navaid.frequency_khz == null
                          ? "Not available"
                          : navaid.type.startsWith("NDB")
                            ? `${navaid.frequency_khz} kHz`
                            : `${navaid.frequency_khz / 1000} MHz`}
                      </td>
                      <td>
                        {formatQuantity(
                          navaid.distanceNm,
                          "distance",
                          preferences.units,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!detail.navaids.length && <p>No nearby navaid records.</p>}
          </section>
        </div>
        <div>
          <section>
            <h2>Airport information</h2>
            <dl className="data-list">
              {Object.entries({
                Municipality: airport.municipality,
                Region: detail.regionName,
                Country: detail.countryName,
                Elevation: formatQuantity(
                  airport.elevation_ft,
                  "altitude",
                  preferences.units,
                ),
                "Local time": now
                  ? formatTime(now, detail.timezone)
                  : "Loading",
                "Time zone (inferred)": detail.timezone,
                "Local identifier": airport.local_code,
                "GPS code": airport.gps_code,
                Type: airport.type.replaceAll("_", " "),
              }).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value || "Not available"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            {station ? (
              <StationWeatherView station={station} />
            ) : (
              <p>No weather station identifier available.</p>
            )}
          </section>
          <section>
            <h2>NOTAMs</h2>
            <p>NOTAM integration not configured.</p>
          </section>
        </div>
      </div>
      <section>
        <h2>Observed traffic within 25 NM</h2>
        <p>ADS-B observations, not a complete arrival or departure schedule.</p>
        {traffic.error && <p>Live traffic temporarily unavailable.</p>}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Aircraft</th>
                <th>Registration</th>
                <th>Altitude</th>
                <th>Groundspeed</th>
                <th>Vertical rate</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {traffic.data?.aircraft.slice(0, 100).map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      href={`/map?aircraft=${item.id}&lat=${airport.latitude_deg}&lon=${airport.longitude_deg}&zoom=9`}
                    >
                      {item.callsign?.value || item.id}
                    </Link>
                  </td>
                  <td>{item.registration?.value || "N/A"}</td>
                  <td>
                    {formatAltitude(item.altBaro?.value, preferences.units)}
                  </td>
                  <td>
                    {formatQuantity(
                      item.groundSpeed?.value,
                      "speed",
                      preferences.units,
                    )}
                  </td>
                  <td>
                    {formatQuantity(
                      item.verticalRate?.value,
                      "verticalRate",
                      preferences.units,
                    )}
                  </td>
                  <td>{item.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <AirportSchedules airport={airport.icao_code || airport.iata_code || airport.ident} />
    </>
  );
}
