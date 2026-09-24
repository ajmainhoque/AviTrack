"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Compass,
  Expand,
  Heart,
  Layers,
  LocateFixed,
  Map,
  Moon,
  Plane,
  Radio,
  Ruler,
  Settings2,
  SlidersHorizontal,
  Sun,
  Table2,
} from "lucide-react";
import { useTracker, usePreferences, matchesFilter } from "@/lib/client/store";
import { useLive } from "./use-live";
import { Search } from "./search";
import { Compare, FlightTable, MapPanels, type Panel } from "./map-panels";
import { IconButton } from "../common/icon-button";
import { mapHandle } from "@/lib/map/handle";
import { distanceNm, bearingDegrees } from "@/lib/aviation/calculations";
import { formatQuantity, formatTime } from "@/lib/aviation/units";
import type { Coordinate } from "@/lib/aviation/model";
import { useNow } from "@/lib/client/clock";
import { ForegroundAlertMonitor, useAlerts } from "./foreground-alerts";
const LiveMap = dynamic(() => import("./live-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading basemap...</div>,
});
const FlightPanel = dynamic(() => import("../flight/flight-panel"), {
  ssr: false,
});
const ReferenceLayers = dynamic(() => import("./reference-layers").then((module) => module.ReferenceLayers), { ssr: false });
export function Tracker({ initialIdentifier }: { initialIdentifier?: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [table, setTable] = useState(false);
  const now = useNow();
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const selected = useTracker((state) => state.selected);
  const aircraft = useTracker((state) => state.aircraft);
  const filter = useTracker((state) => state.filter);
  const view = useTracker((state) => state.view);
  const preferences = usePreferences();
  const alertCount = useAlerts((state) => state.entries.length);
  const clock = now ? formatTime(now, preferences.timeZone, true) : "UTC";
  const live = useLive();
  useEffect(() => {
    if (initialIdentifier) useTracker.getState().select(initialIdentifier);
  }, [initialIdentifier]);
  useEffect(() => {
    const connection = () => setOffline(!navigator.onLine);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, []);
  useEffect(() => {
    if (!measuring || !mapHandle.current) return;
    const map = mapHandle.current;
    let first: Coordinate | null = null;
    map.getCanvas().style.cursor = "crosshair";
    const click = (event: { lngLat: { lng: number; lat: number } }) => {
      const coordinate: Coordinate = [event.lngLat.lng, event.lngLat.lat];
      if (!first) {
        first = coordinate;
        setNotice("Measurement: first point selected");
      } else {
        setNotice(
          `${formatQuantity(distanceNm(first, coordinate), "distance", usePreferences.getState().units)} / initial bearing ${bearingDegrees(first, coordinate).toFixed(1)} deg`,
        );
        setMeasuring(false);
      }
    };
    map.on("click", click);
    return () => {
      map.off("click", click);
      map.getCanvas().style.cursor = "";
    };
  }, [measuring]);
  const visible = Object.values(aircraft).filter(
    (item) =>
      matchesFilter(item, filter) &&
      item.position &&
      now - (item.position.observedAt ?? 0) < 120000,
  );
  const toggle = (next: Panel) => setPanel(panel === next ? null : next);
  function geolocate() {
    setNotice("Your location is used only to center the map.");
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        mapHandle.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 9,
        });
        setNotice("");
      },
      () => setNotice("Location unavailable or permission denied."),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }
  return (
    <main
      className={`tracker ${preferences.theme} ${selected ? "has-selection" : ""} ${table ? "has-table" : ""}`}
    >
      <header className="topbar">
        <Link href="/" className="brand" aria-label="AviTrack home">
          <span className="brand-mark">
            <Plane size={20} />
          </span>
          <span>
            avi<span className="brand-light">track</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="topbar-divider" />
        <div className="workspace-title">
          <Radio size={14} />
          <span>Live airspace</span>
        </div>
        <nav className="header-links">
          <Link href="/about/data-sources">Data sources</Link>
          <Link href="/about">About</Link>
        </nav>
        <span className="header-clock small-mono">{clock || "UTC"}</span>
        <button className="source-status" onClick={() => toggle("status")}>
          <span
            className={`status-dot ${live.regional.error ? "stale" : live.regional.data ? "live" : "delayed"}`}
          />
          <span>
            {live.regional.error
              ? "Source interrupted"
              : live.regional.data?.source || "Connecting"}
          </span>
          <Activity size={14} />
        </button>
      </header>
      <div className="map-stage">
        <LiveMap />
      </div>
      <ReferenceLayers />
      <ForegroundAlertMonitor />
      <nav className="left-rail" aria-label="Map tools">
        <IconButton
          label="Live map"
          active={!table}
          onClick={() => setTable(false)}
        >
          <Map size={21} />
        </IconButton>
        <IconButton
          label="Observed traffic table"
          active={table}
          onClick={() => setTable(!table)}
        >
          <Table2 size={21} />
        </IconButton>
        <div className="rail-separator" />
        <IconButton
          label="Map layers"
          active={panel === "layers"}
          onClick={() => toggle("layers")}
        >
          <Layers size={21} />
        </IconButton>
        <IconButton
          label="Traffic filters"
          active={panel === "filters"}
          onClick={() => toggle("filters")}
        >
          <SlidersHorizontal size={21} />
        </IconButton>
        <IconButton
          label="Watchlist"
          active={panel === "watchlist"}
          onClick={() => toggle("watchlist")}
        >
          <Heart size={21} />
        </IconButton>
        <div className="rail-separator" />
        <IconButton label="Center on my location" onClick={geolocate}>
          <LocateFixed size={21} />
        </IconButton>
        <IconButton
          label="Measure distance and bearing"
          active={measuring}
          onClick={() => {
            setMeasuring(!measuring);
            setNotice("");
          }}
        >
          <Ruler size={21} />
        </IconButton>
        <IconButton
          label="Toggle 3D map"
          onClick={() =>
            mapHandle.current?.easeTo({
              pitch: mapHandle.current.getPitch() ? 0 : 55,
              duration: 700,
            })
          }
        >
          <Compass size={21} />
        </IconButton>
        <IconButton
          label="Fullscreen map"
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else
              document.documentElement
                .requestFullscreen()
                .catch(() => setNotice("Fullscreen is not supported."));
          }}
        >
          <Expand size={20} />
        </IconButton>
        <div className="rail-bottom">
          <IconButton label={`Foreground alerts${alertCount ? ` (${alertCount})` : ""}`} active={panel === "alerts"} onClick={() => toggle("alerts")}><Bell size={20} /></IconButton>
          <IconButton
            label="Switch light and dark theme"
            onClick={() =>
              preferences.update({
                theme: preferences.theme === "dark" ? "light" : "dark",
              })
            }
          >
            {preferences.theme === "dark" ? (
              <Sun size={20} />
            ) : (
              <Moon size={20} />
            )}
          </IconButton>
          <IconButton
            label="Preferences"
            active={panel === "settings"}
            onClick={() => toggle("settings")}
          >
            <Settings2 size={20} />
          </IconButton>
        </div>
      </nav>
      <Search />
      <div className="coverage-pill surface">
        <span className="tiny-crosshair" />
        <span>
          {live.config?.global && !view.regional
            ? "Global coverage"
            : "Regional live coverage"}
        </span>
        <span className="small-mono">
          {view.regional ? `${view.radius} NM` : "Zoom in"}
        </span>
      </div>
      {!selected && (
        <aside className="airspace-summary surface">
          <div className="eyebrow">IN THIS REGION</div>
          <div className="traffic-count">
            {live.regional.isLoading ? (
              <span className="skeleton count-skeleton" />
            ) : view.regional ? (
              visible.length
            ) : (
              "--"
            )}
            <span>aircraft observed</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-row">
            <span>
              <span className="legend-dot" />
              Airborne
            </span>
            <strong>
              {
                visible.filter(
                  (item) => typeof item.altBaro?.value === "number",
                ).length
              }
            </strong>
          </div>
          <div className="summary-row">
            <span>
              <span className="legend-dot ground" />
              On ground
            </span>
            <strong>
              {
                visible.filter((item) => item.altBaro?.value === "ground")
                  .length
              }
            </strong>
          </div>
          <button
            className="text-button summary-link"
            onClick={() => setTable(true)}
          >
            Observed traffic <Table2 size={14} />
          </button>
        </aside>
      )}
      {!view.regional && !live.config?.global && (
        <div className="map-message surface">
          <Compass size={25} />
          <strong>Zoom in for live regional traffic</strong>
          <span>
            The free regional source does not provide a global snapshot.
          </span>
          <button
            className="button primary"
            onClick={() => mapHandle.current?.zoomTo(7)}
          >
            Zoom to region
          </button>
        </div>
      )}
      {(offline || notice || live.regional.error) && (
        <div className="map-notice surface" role="status">
          {offline
            ? "Live data unavailable offline."
            : notice ||
              `${live.regional.error?.message}. Cached observations will fade as they age.`}
          {notice && (
            <button className="text-button" onClick={() => setNotice("")}>
              Dismiss
            </button>
          )}
        </div>
      )}
      <MapPanels panel={panel} close={() => setPanel(null)} />
      {selected && (
        <FlightPanel
          key={selected}
          aircraft={aircraft[selected] ?? null}
          unavailable={
            live.chosen.error?.message ||
            (live.chosen.data && !live.chosen.data.aircraft.length
              ? "No current observation"
              : undefined)
          }
        />
      )}
      <Compare />
      {table && <FlightTable close={() => setTable(false)} />}
      <div className="map-legend surface">
        <span>
          <i className="legend-line actual" />
          Observed
        </span>
        <span>
          <i className="legend-line direct" />
          Direct reference
        </span>
        {preferences.layers.projection && (
          <span>
            <i className="legend-line predicted" />
            Estimated
          </span>
        )}
      </div>
      <footer className="statusbar">
        <span>
          <span
            className={`status-dot ${offline || live.regional.error ? "stale" : live.regional.isFetching ? "delayed" : live.regional.data ? "live" : "delayed"}`}
          />
          {offline
            ? "Offline"
            : live.regional.isFetching
              ? "Refreshing"
              : live.regional.error
                ? "Provider interrupted"
                : !view.regional && !live.config?.global
                  ? "Regional coverage paused"
                  : live.regional.data
                    ? "Live observations"
                    : live.config?.stream
                      ? "Stream configured"
                      : "Connecting"}
          <span className="status-secondary">
            {" "}
            /{" "}
            {live.config
              ? `${live.config.refreshMs / 1000}s refresh`
              : "connecting"}
          </span>
        </span>
        <span className="safety-note">
          Informational only. Not for navigation or safety-of-flight.
        </span>
        <button
          className="text-button small-mono"
          onClick={() => toggle("settings")}
        >
          {preferences.units.toUpperCase()} /{" "}
          {preferences.timeZone.toUpperCase()}
        </button>
      </footer>
    </main>
  );
}
