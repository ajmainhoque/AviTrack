"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Crosshair,
  ExternalLink,
  Heart,
  Plane,
  Share2,
  X,
  ChartNoAxesCombined,
  Focus,
  GitCompareArrows,
} from "lucide-react";
import { IconButton } from "../common/icon-button";
import { usePreferences, useTracker } from "@/lib/client/store";
import { apiFetch } from "@/lib/client/query";
import {
  emergency,
  estimateProgress,
  freshness,
  inferPhase,
} from "@/lib/aviation/calculations";
import {
  formatAltitude,
  formatQuantity,
  formatTime,
} from "@/lib/aviation/units";
import type {
  AircraftMetadata,
  AircraftState,
  DataValue,
  Route,
} from "@/lib/aviation/model";
import { mapHandle } from "@/lib/map/handle";
import { RouteWeather, AirportProximity } from "./flight-context";
import { ScheduleSection } from "./schedule-section";
const TrackCharts = dynamic(() => import("../charts/track-charts"), {
  ssr: false,
});
const descriptions: Record<string, string> = {
  nic: "Navigation Integrity Category",
  nac_p: "Navigation Accuracy Category for Position",
  nac_v: "Navigation Accuracy Category for Velocity",
  sil: "Source Integrity Level",
  sda: "System Design Assurance",
  gva: "Geometric Vertical Accuracy",
  rc: "Containment radius in metres",
  nic_baro: "Barometric altitude integrity supplement",
  rssi: "Received signal strength in dBFS",
  track: "Direction of movement across the ground, not nose heading",
  alt_geom:
    "Geometric altitude above the reference ellipsoid; not pressure altitude",
  nav_qnh: "Broadcast selected altimeter setting in hPa",
  ias: "Indicated airspeed in knots",
  tas: "True airspeed in knots",
  mag_heading: "Nose heading relative to magnetic north",
  true_heading: "Nose heading relative to true north",
};
function provenance(value: DataValue<unknown> | null | undefined, now: number) {
  return value
    ? `${value.kind} | ${value.source} | ${value.observedAt == null ? "Observation time not supplied" : `${Math.max(0, Math.round((now - value.observedAt) / 1000))}s old; ${new Date(value.observedAt).toISOString()}`} | received ${new Date(value.receivedAt).toISOString()} | confidence: ${value.confidence}`
    : "Not available";
}
export default function FlightPanel({
  aircraft,
  unavailable,
}: {
  aircraft: AircraftState | null;
  unavailable?: string;
}) {
  const selected = useTracker((state) => state.selected);
  const follow = useTracker((state) => state.follow);
  const trail = useTracker((state) => state.trail);
  const preferences = usePreferences();
  const [tab, setTab] = useState<"overview" | "data" | "history">("overview");
  const [now, setNow] = useState(0);
  const [shareStatus, setShareStatus] = useState("");
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const callsign = aircraft?.callsign?.value;
  const metadata = useQuery({
    queryKey: ["metadata", selected],
    queryFn: ({ signal }) =>
      apiFetch<{ data: DataValue<AircraftMetadata> | null }>(
        `/api/enrichment?id=${encodeURIComponent(selected!)}`,
        signal,
      ),
    enabled: Boolean(selected),
    staleTime: 86400000,
  });
  const route = useQuery({
    queryKey: ["route", callsign],
    queryFn: ({ signal }) =>
      apiFetch<{ data: DataValue<Route> | null }>(
        `/api/enrichment?kind=route&id=${encodeURIComponent(callsign!)}`,
        signal,
      ),
    enabled: Boolean(callsign && /^[A-Za-z0-9-]{2,16}$/.test(callsign)),
    staleTime: 900000,
  });
  useEffect(() => {
    useTracker.setState({ route: route.data?.data ?? null });
  }, [route.data, selected]);
  if (!selected) return null;
  const details = metadata.data?.data;
  const routeValue = route.data?.data;
  const fresh = aircraft
    ? freshness(
        aircraft.position?.observedAt ?? null,
        now || aircraft.receivedAt,
      )
    : "unknown";
  const label =
    callsign ||
    aircraft?.registration?.value ||
    details?.value.registration ||
    selected.toUpperCase();
  const favorite = preferences.favorites.some(
    (entry) => entry.id === selected && entry.type === "aircraft",
  );
  const progress =
    aircraft && routeValue
      ? estimateProgress(
          aircraft,
          routeValue.value.origin.coordinate,
          routeValue.value.destination.coordinate,
          now,
        )
      : null;
  const transponder = aircraft
    ? emergency(
        aircraft.squawk?.value ?? null,
        typeof aircraft.fields.emergency?.value === "string"
          ? aircraft.fields.emergency.value
          : null,
      )
    : null;
  const close = () => {
    useTracker.getState().select(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("aircraft");
    window.history.replaceState(null, "", url);
  };
  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("aircraft", selected);
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("Link copied");
    } catch {
      setShareStatus("Copy the address from your browser");
    }
  };
  return (
    <aside
      className="flight-panel surface"
      aria-label="Selected aircraft details"
    >
      <div className="sheet-handle" />
      <div className="flight-heading">
        <div className="eyebrow">
          <span className={`status-dot ${fresh}`} />
          {fresh === "live" ? "Live observation" : `${fresh} position`}
        </div>
        <IconButton label="Close flight details" onClick={close}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="flight-title">
        <div>
          <h1>{label}</h1>
          <p>
            {routeValue?.value.airline?.name ||
              details?.value.owner ||
              "Operator not available"}
          </p>
        </div>
        <div className="aircraft-glyph">
          <Plane size={32} strokeWidth={1.2} />
        </div>
      </div>
      <div className="identity-line">
        <span>
          {aircraft?.aircraftType?.value ||
            details?.value.type ||
            "Type unavailable"}
        </span>
        <span>
          {aircraft?.registration?.value ||
            details?.value.registration ||
            selected.toUpperCase()}
        </span>
        <span className="source-badge">
          {aircraft?.positionSource || "No live signal"}
        </span>
      </div>
      <div className="flight-actions">
        <button
          className={`button ${follow ? "primary" : ""}`}
          onClick={() => {
            useTracker.setState({ follow: !follow });
            if (aircraft?.position)
              mapHandle.current?.easeTo({
                center: aircraft.position.value,
                zoom: Math.max(mapHandle.current.getZoom(), 8),
              });
          }}
          disabled={!aircraft?.position}
        >
          <Crosshair size={15} />
          {follow ? "Following" : "Follow"}
        </button>
        <IconButton
          label={favorite ? "Remove from watchlist" : "Add to watchlist"}
          active={favorite}
          onClick={() =>
            preferences.toggleFavorite({
              id: selected,
              label,
              type: "aircraft",
            })
          }
        >
          <Heart size={17} fill={favorite ? "currentColor" : "none"} />
        </IconButton>
        <IconButton label="Share flight" onClick={share}>
          <Share2 size={17} />
        </IconButton>
        <IconButton
          label="Fit observed track"
          disabled={!trail.length}
          onClick={() => {
            const coordinates = trail.map((item) => item.coordinate);
            if (coordinates.length) {
              const longitudes = coordinates.map((item) => item[0]);
              const latitudes = coordinates.map((item) => item[1]);
              mapHandle.current?.fitBounds(
                [
                  [Math.min(...longitudes), Math.min(...latitudes)],
                  [Math.max(...longitudes), Math.max(...latitudes)],
                ],
                { padding: 100, maxZoom: 12 },
              );
            }
          }}
        >
          <Focus size={17} />
        </IconButton>
        <IconButton
          label="Compare aircraft"
          onClick={() =>
            useTracker.setState((state) => ({
              compare: state.compare.includes(selected)
                ? state.compare.filter((id) => id !== selected)
                : [...state.compare, selected].slice(-3),
            }))
          }
        >
          <GitCompareArrows size={17} />
        </IconButton>
        <Link
          className="icon-button"
          title="Aircraft page"
          aria-label="Aircraft page"
          href={`/aircraft/${selected}`}
        >
          <ExternalLink size={17} />
        </Link>
      </div>
      {shareStatus && (
        <p className="inline-note" role="status">
          {shareStatus}
        </p>
      )}
      {transponder && <div className="notice danger">{transponder}</div>}
      {unavailable && (
        <div className="notice">{unavailable}. Last observation retained.</div>
      )}
      <div className="tabs" role="tablist" aria-label="Flight information">
        <button
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          role="tab"
          aria-selected={tab === "data"}
          onClick={() => setTab("data")}
        >
          ADS-B & sources
        </button>
        <button
          role="tab"
          aria-selected={tab === "history"}
          onClick={() => setTab("history")}
        >
          <ChartNoAxesCombined size={14} />
          History
        </button>
      </div>
      <div className="panel-scroll" role="tabpanel">
        {tab === "overview" && (
          <>
            <section className="route-section">
              <div className="section-heading">
                <h2>Route</h2>
                <span className="source-badge">
                  {routeValue ? "Enriched" : "Not available"}
                </span>
              </div>
              {routeValue ? (
                <>
                  <div className="route-codes">
                    <Link href={`/airport/${routeValue.value.origin.ident}`}>
                      {routeValue.value.origin.iata ||
                        routeValue.value.origin.ident}
                    </Link>
                    <ArrowRight size={22} />
                    <Link
                      href={`/airport/${routeValue.value.destination.ident}`}
                    >
                      {routeValue.value.destination.iata ||
                        routeValue.value.destination.ident}
                    </Link>
                  </div>
                  <div className="route-names">
                    <span>
                      {routeValue.value.origin.municipality ||
                        routeValue.value.origin.name}
                    </span>
                    <span>
                      {routeValue.value.destination.municipality ||
                        routeValue.value.destination.name}
                    </span>
                  </div>
                  <div className="progress-line">
                    <span
                      style={{ width: `${(progress?.progress ?? 0) * 100}%` }}
                    />
                  </div>
                  <p
                    className="inline-note"
                    title={provenance(routeValue, now)}
                  >
                    Public callsign lookup; current route not confirmed.
                  </p>
                  {progress && (
                    <div className="route-stats">
                      <span>
                        {formatQuantity(
                          progress.remaining,
                          "distance",
                          preferences.units,
                        )}{" "}
                        remaining
                      </span>
                      <span>
                        {progress.etaMinutes != null
                          ? `~${Math.round(progress.etaMinutes)} min`
                          : "ETA unavailable"}
                      </span>
                    </div>
                  )}
                  {progress?.etaMinutes != null && (
                    <p className="inline-note">
                      Estimated from current track/speed
                    </p>
                  )}
                </>
              ) : (
                <div className="empty-inline">
                  {route.isFetching
                    ? "Resolving callsign..."
                    : "Origin and destination not available."}
                </div>
              )}
              <ScheduleSection callsign={callsign} />
              {routeValue && <RouteWeather route={routeValue.value} />}
            </section>
            <section>
              <div className="section-heading">
                <h2>Live telemetry</h2>
                <span className="small-mono">
                  {aircraft?.position?.observedAt
                    ? formatTime(
                        aircraft.position.observedAt,
                        preferences.timeZone,
                        true,
                      )
                    : "Time unknown"}
                </span>
              </div>
              <div className="telemetry-grid">
                <div
                  title={`Barometric altitude references standard pressure, not terrain. ${provenance(aircraft?.altBaro, now)}`}
                >
                  <span>BAROMETRIC ALT.</span>
                  <strong>
                    {formatAltitude(
                      aircraft?.altBaro?.value,
                      preferences.units,
                    )}
                  </strong>
                </div>
                <div title={provenance(aircraft?.groundSpeed, now)}>
                  <span>GROUND SPEED</span>
                  <strong>
                    {formatQuantity(
                      aircraft?.groundSpeed?.value,
                      "speed",
                      preferences.units,
                    )}
                  </strong>
                </div>
                <div title={provenance(aircraft?.verticalRate, now)}>
                  <span>VERTICAL RATE</span>
                  <strong>
                    {formatQuantity(
                      aircraft?.verticalRate?.value,
                      "verticalRate",
                      preferences.units,
                    )}
                  </strong>
                </div>
                <div
                  title={`Ground track, not nose heading. ${provenance(aircraft?.track, now)}`}
                >
                  <span>GROUND TRACK</span>
                  <strong>
                    {aircraft?.track
                      ? `${aircraft.track.value.toFixed(0)} deg`
                      : "Not available"}
                  </strong>
                </div>
              </div>
              <div className="data-row">
                <span>Inferred flight phase</span>
                <strong>{inferPhase(trail)}</strong>
              </div>
              <div className="data-row">
                <span>Squawk</span>
                <strong>{aircraft?.squawk?.value ?? "Not available"}</strong>
              </div>
            </section>
            <section>
              <div className="section-heading">
                <h2>Aircraft</h2>
                <span className="source-badge">Enriched</span>
              </div>
              {metadata.isFetching && !details ? (
                <div className="skeleton" />
              ) : (
                <dl className="data-list" title={provenance(details, now)}>
                  {Object.entries({
                    Manufacturer: details?.value.manufacturer,
                    Model: details?.value.model,
                    Registration:
                      aircraft?.registration?.value ||
                      details?.value.registration,
                    "Mode-S / target ID": selected.toUpperCase(),
                    "Registered owner": details?.value.owner,
                    Country: details?.value.country,
                  }).map(([name, value]) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>{value || "Not available"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
            <section>
              <div className="section-heading">
                <h2>Captured trajectory</h2>
                <span className="small-mono">{trail.length} observations</span>
              </div>
              <p className="inline-note">
                Local observations from this device. Not complete flight
                history.
              </p>
              <button className="button wide" onClick={() => setTab("history")}>
                <ChartNoAxesCombined size={16} />
                Open charts & playback
              </button>
            </section>
            {aircraft && (
              <AirportProximity
                aircraft={aircraft}
                destination={routeValue?.value.destination.ident}
              />
            )}
          </>
        )}
        {tab === "data" && (
          <>
            <section>
              <h2>Position & freshness</h2>
              <dl className="data-list">
                <div>
                  <dt>Latitude / longitude</dt>
                  <dd title={provenance(aircraft?.position, now)}>
                    {aircraft?.position
                      ? `${aircraft.position.value[1].toFixed(5)}, ${aircraft.position.value[0].toFixed(5)}`
                      : "Not available"}
                  </dd>
                </div>
                <div>
                  <dt>Position age</dt>
                  <dd>
                    {aircraft?.position?.observedAt
                      ? `${Math.max(0, Math.round((now - aircraft.position.observedAt) / 1000))}s`
                      : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt>Message age</dt>
                  <dd>
                    {aircraft?.messageAt
                      ? `${Math.max(0, Math.round((now - aircraft.messageAt) / 1000))}s`
                      : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt>Geometric altitude</dt>
                  <dd title={provenance(aircraft?.altGeom, now)}>
                    {formatAltitude(
                      aircraft?.altGeom?.value,
                      preferences.units,
                    )}
                  </dd>
                </div>
              </dl>
            </section>
            <section>
              <h2>Avionics & signal</h2>
              <p className="inline-note">
                Broadcast values in native aviation units. Hover or focus a
                value for provenance.
              </p>
              <dl className="data-list raw-fields">
                {Object.entries(aircraft?.fields ?? {}).map(([key, value]) => (
                  <div key={key}>
                    <dt title={descriptions[key] || key}>
                      {key.replaceAll("_", " ")}
                    </dt>
                    <dd
                      tabIndex={0}
                      title={`${descriptions[key] || key}. ${provenance(value, now)}`}
                    >
                      {Array.isArray(value.value)
                        ? value.value.join(", ") || "None reported"
                        : String(value.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h2>Data details</h2>
              <p className="inline-note">
                Observed does not mean verified. Field-specific observation
                times are not supplied for most broadcast fields; message time
                is their latest possible timestamp.
              </p>
              <p className="inline-note">{provenance(details, now)}</p>
              <p className="inline-note">{provenance(routeValue, now)}</p>
            </section>
            {process.env.NODE_ENV === "development" && (
              <details>
                <summary>Developer normalized inspector</summary>
                <pre>
                  {JSON.stringify(
                    { aircraft, metadata: details, route: routeValue },
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
          </>
        )}
        {tab === "history" && <TrackCharts />}
      </div>
      <div className="panel-footer">
        <span className={`status-dot ${fresh}`} />
        {aircraft?.source ?? "Waiting for provider"}
        <span>{fresh}</span>
      </div>
    </aside>
  );
}
