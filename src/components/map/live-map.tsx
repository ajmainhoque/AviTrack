"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource } from "maplibre-gl";
import { mapHandle } from "@/lib/map/handle";
import { Protocol } from "pmtiles";
import { usePreferences, useTracker, matchesFilter } from "@/lib/client/store";
import {
  directRoute,
  distanceNm,
  emergency,
  freshness,
  headingDifference,
  interpolatePosition,
  projectedTrack,
  splitAntimeridian,
} from "@/lib/aviation/calculations";
import { formatAltitude, formatQuantity } from "@/lib/aviation/units";
import type { Coordinate } from "@/lib/aviation/model";
import { circle, featureCollection, lineString, point } from "@turf/turf";

const empty: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const protocol = new Protocol();
let protocolAdded = false;
function planeImage(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.scale(2, 2);
  context.fillStyle = color;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 0.65;
  context.beginPath();
  context.moveTo(16, 2);
  context.bezierCurveTo(14, 2, 14, 6, 14, 12);
  context.lineTo(3, 20);
  context.lineTo(3, 23);
  context.lineTo(14, 19);
  context.lineTo(14, 26);
  context.lineTo(10, 29);
  context.lineTo(10, 31);
  context.lineTo(16, 29);
  context.lineTo(22, 31);
  context.lineTo(22, 29);
  context.lineTo(18, 26);
  context.lineTo(18, 19);
  context.lineTo(29, 23);
  context.lineTo(29, 20);
  context.lineTo(18, 12);
  context.bezierCurveTo(18, 6, 18, 2, 16, 2);
  context.closePath();
  context.fill();
  context.stroke();
  return context.getImageData(0, 0, 64, 64);
}
export default function LiveMap() {
  const container = useRef<HTMLDivElement>(null);
  const theme = usePreferences((state) => state.theme);
  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    if (!protocolAdded) {
      maplibregl.addProtocol("pmtiles", protocol.tile);
      protocolAdded = true;
    }
    const url = new URL(window.location.href);
    const sharedUnits = url.searchParams.get("units");
    if (
      sharedUnits === "aviation" ||
      sharedUnits === "metric" ||
      sharedUnits === "us"
    )
      usePreferences.getState().update({ units: sharedUnits });
    const sharedLayers = url.searchParams.get("layers");
    if (sharedLayers !== null) {
      const enabled = new Set(sharedLayers.split(","));
      const layers = { ...usePreferences.getState().layers };
      for (const name of Object.keys(layers) as (keyof typeof layers)[])
        layers[name] = enabled.has(name);
      usePreferences.getState().update({ layers });
    }
    const number = (
      key: string,
      fallback: number,
      minimum: number,
      maximum: number,
    ) => {
      const raw = url.searchParams.get(key);
      const value = raw === null ? fallback : Number(raw);
      return Number.isFinite(value)
        ? Math.min(maximum, Math.max(minimum, value))
        : fallback;
    };
    const initial = useTracker.getState().view;
    const map = new maplibregl.Map({
      container: container.current,
      style:
        process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
        (theme === "dark"
          ? "https://tiles.openfreemap.org/styles/dark"
          : "https://tiles.openfreemap.org/styles/positron"),
      center: [
        number("lon", initial.center[0], -180, 180),
        number("lat", initial.center[1], -85, 85),
      ],
      zoom: number("zoom", initial.zoom, 1, 18),
      maxZoom: 19,
      attributionControl: {
        compact: true,
        customAttribution:
          '<a href="https://www.adsb.lol/">ADSB.lol</a> | <a href="https://opendatacommons.org/licenses/odbl/">ODbL</a>',
      },
    });
    mapHandle.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "bottom-left",
    );
    map.addControl(
      new maplibregl.ScaleControl({ unit: "nautical" }),
      "bottom-left",
    );
    let frame = 0;
    let lastPaint = 0;
    let lastFollow = 0;
    const motion = new Map<
      string,
      {
        from: Coordinate;
        to: Coordinate;
        started: number;
        previousTrack: number;
        track: number;
        received: number;
      }
    >();
    const updateView = () => {
      const center = map.getCenter();
      const bounds = map.getBounds();
      const coordinate: Coordinate = [
        ((center.lng + 540) % 360) - 180,
        center.lat,
      ];
      const radius = Math.ceil(Math.max(...[bounds.getNorthEast(), bounds.getNorthWest(), bounds.getSouthEast(), bounds.getSouthWest()].map((corner) => distanceNm(coordinate, [((corner.lng + 540) % 360) - 180, Math.max(-89.9, Math.min(89.9, corner.lat))]))));
      useTracker.getState().setView({
        center: coordinate,
        zoom: map.getZoom(),
        radius: Math.min(250, Math.max(10, radius)),
        regional: radius <= 250 && map.getZoom() >= 5,
      });
      const current = new URL(window.location.href);
      current.searchParams.set("lat", center.lat.toFixed(4));
      current.searchParams.set("lon", coordinate[0].toFixed(4));
      current.searchParams.set("zoom", map.getZoom().toFixed(2));
      if (useTracker.getState().selected)
        current.searchParams.set("aircraft", useTracker.getState().selected!);
      else current.searchParams.delete("aircraft");
      current.searchParams.set("units", usePreferences.getState().units);
      current.searchParams.set(
        "layers",
        Object.entries(usePreferences.getState().layers)
          .filter(([, enabled]) => enabled)
          .map(([name]) => name)
          .join(","),
      );
      window.history.replaceState(null, "", current);
    };
    const unsubscribePreferences = usePreferences.subscribe(
      (state, previous) => {
        if (state.units !== previous.units || state.layers !== previous.layers)
          updateView();
      },
    );
    const applyPanelPadding = () => {
      const selected = useTracker.getState().selected;
      const height = map.getContainer().clientHeight;
      const mobile = window.innerWidth <= 760;
      map.setPadding(selected ? { top: mobile ? Math.min(110, height * 0.2) : 20, bottom: mobile ? Math.min(window.innerHeight * 0.55, height * 0.65) : 20, left: mobile ? 10 : 20, right: mobile ? 10 : window.innerWidth >= 1500 ? 432 : window.innerWidth <= 1100 ? 377 : 402 } : { top: 0, bottom: 0, left: 0, right: 0 });
    };
    const unsubscribeSelection = useTracker.subscribe((state, previous) => {
      if (state.selected !== previous.selected) { applyPanelPadding(); updateView(); }
    });
    map.on("resize", applyPanelPadding);
    map.on("moveend", updateView);
    map.on("dragstart", () => useTracker.setState({ follow: false }));
    map.on("rotatestart", (event) => {
      if (event.originalEvent) useTracker.setState({ follow: false });
    });
    map.on("load", () => {
      map.getContainer().dataset.mapReady = "true";
      for (const [name, color] of Object.entries({
        plane: "#007e78",
        selected: "#d95b19",
        stale: "#8b9093",
        emergency: "#d33f57",
      }))
        map.addImage(name, planeImage(color), { pixelRatio: 2 });
      for (const id of [
        "traffic",
        "trail",
        "reference",
        "projection",
        "route-airports",
        "rings",
        "cursor",
      ])
        map.addSource(id, { type: "geojson", data: empty });
      map.addLayer({
        id: "rings-line",
        type: "line",
        source: "rings",
        paint: {
          "line-color": "#007e78",
          "line-width": 1,
          "line-opacity": 0.35,
          "line-dasharray": [2, 3],
        },
      });
      map.addLayer({
        id: "reference-line",
        type: "line",
        source: "reference",
        paint: {
          "line-color": "#7863a0",
          "line-width": 2,
          "line-dasharray": [5, 4],
          "line-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "trail-line",
        type: "line",
        source: "trail",
        paint: { "line-color": ["get", "color"], "line-width": 3 },
      });
      map.addLayer({
        id: "projection-line",
        type: "line",
        source: "projection",
        paint: {
          "line-color": "#d95b19",
          "line-width": 2,
          "line-dasharray": [1, 3],
        },
      });
      map.addLayer({
        id: "route-airports-circle",
        type: "circle",
        source: "route-airports",
        paint: {
          "circle-radius": 5,
          "circle-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#7863a0",
        },
      });
      map.addLayer({
        id: "route-airports-label",
        type: "symbol",
        source: "route-airports",
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-offset": [0, 1.3],
        },
        paint: {
          "text-color": theme === "dark" ? "#ffffff" : "#34333b",
          "text-halo-color": theme === "dark" ? "#222222" : "#ffffff",
          "text-halo-width": 2,
        },
      });
      map.addLayer({
        id: "aircraft",
        type: "symbol",
        source: "traffic",
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": ["case", ["get", "selected"], 1.15, 0.8],
          "icon-rotate": ["get", "track"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-opacity": ["get", "opacity"] },
      });
      map.addLayer({
        id: "unknown-track",
        type: "circle",
        source: "traffic",
        filter: ["==", ["get", "trackKnown"], false],
        paint: {
          "circle-radius": 4,
          "circle-color": "#007e78",
          "circle-stroke-color": "white",
          "circle-stroke-width": 1,
        },
      });
      map.setFilter("aircraft", ["==", ["get", "trackKnown"], true]);
      map.addLayer({
        id: "aircraft-labels",
        type: "symbol",
        source: "traffic",
        minzoom: 6,
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-offset": [0, 2],
          "text-optional": true,
        },
        paint: {
          "text-color": theme === "dark" ? "#fafafa" : "#174441",
          "text-halo-color": theme === "dark" ? "#252525" : "#ffffff",
          "text-halo-width": 2,
        },
      });
      map.addLayer({
        id: "cursor-point",
        type: "circle",
        source: "cursor",
        paint: {
          "circle-radius": 6,
          "circle-color": "#d95b19",
          "circle-stroke-color": "white",
          "circle-stroke-width": 2,
        },
      });
      const select = (event: maplibregl.MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") {
          useTracker.getState().select(id);
          updateView();
        }
      };
      map.on("click", "aircraft", select);
      map.on("click", "unknown-track", select);
      map.on("mouseenter", "aircraft", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "aircraft", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mousemove", "trail-line", (event) => {
        const timestamp = event.features?.[0]?.properties?.timestamp;
        if (typeof timestamp === "number")
          useTracker.setState({ hoverTime: timestamp });
      });
      map.on("mouseleave", "trail-line", () =>
        useTracker.setState({ hoverTime: null }),
      );
      const sharedAircraft = url.searchParams.get("aircraft");
      if (sharedAircraft && /^[a-zA-Z0-9~-]{2,32}$/.test(sharedAircraft) && useTracker.getState().selected !== sharedAircraft.toLowerCase())
        useTracker.getState().select(sharedAircraft.toLowerCase());
      applyPanelPadding();
      updateView();
      const paint = (time: number) => {
        frame = requestAnimationFrame(paint);
        if (document.hidden || time - lastPaint < 100) return;
        lastPaint = time;
        const state = useTracker.getState();
        const preferences = usePreferences.getState();
        const now = Date.now();
        const aircraftFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
        for (const aircraft of Object.values(state.aircraft)) {
          if (
            !aircraft.position ||
            !matchesFilter(aircraft, state.filter) ||
            (!state.view.regional &&
              !state.globalCoverage &&
              aircraft.id !== state.selected)
          )
            continue;
          const fresh = freshness(aircraft.position.observedAt, now);
          if (fresh === "lost" && aircraft.id !== state.selected) continue;
          let movement = motion.get(aircraft.id);
          const angle =
            aircraft.track?.value ??
            (typeof aircraft.fields.calc_track?.value === "number"
              ? aircraft.fields.calc_track.value
              : 0);
          if (!movement || aircraft.receivedAt !== movement.received) {
            const previousCoordinate = movement
              ? interpolatePosition(
                  movement.from,
                  movement.to,
                  Math.min(1, (time - movement.started) / 2200),
                )
              : aircraft.position.value;
            const teleport =
              distanceNm(previousCoordinate, aircraft.position.value) >
              Math.max(
                10,
                ((now - (movement?.received ?? now)) / 3600000) * 2500,
              );
            movement = {
              from: teleport ? aircraft.position.value : previousCoordinate,
              to: aircraft.position.value,
              started: time,
              previousTrack: movement?.track ?? angle,
              track: angle,
              received: aircraft.receivedAt,
            };
            motion.set(aircraft.id, movement);
          }
          const interpolate =
            preferences.interpolation &&
            !preferences.reducedMotion &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
            fresh === "live";
          const fraction = interpolate
            ? Math.min(1, (time - movement.started) / 2200)
            : 1;
          let position = interpolatePosition(
            movement.from,
            movement.to,
            fraction,
          );
          if (state.playbackTime && aircraft.id === state.selected)
            position =
              state.trail.reduce(
                (closest, item) =>
                  Math.abs(item.timestamp - state.playbackTime!) <
                  Math.abs(closest.timestamp - state.playbackTime!)
                    ? item
                    : closest,
                state.trail[0],
              )?.coordinate ?? position;
          const alert = emergency(
            aircraft.squawk?.value ?? null,
            typeof aircraft.fields.emergency?.value === "string"
              ? aircraft.fields.emergency.value
              : null,
          );
          const isSelected = aircraft.id === state.selected;
          if (isSelected) {
            const projected = map.project(position);
            map.getContainer().dataset.selectedScreen = JSON.stringify([projected.x, projected.y]);
          }
          aircraftFeatures.push(
            point(position, {
              id: aircraft.id,
              selected: isSelected,
              track:
                movement.previousTrack +
                headingDifference(movement.previousTrack, movement.track) *
                  fraction,
              trackKnown:
                aircraft.track != null || aircraft.fields.calc_track != null,
              icon: alert
                ? "emergency"
                : isSelected
                  ? "selected"
                  : fresh === "live"
                    ? "plane"
                    : "stale",
              opacity: fresh === "live" ? 1 : 0.55,
              label: `${aircraft.callsign?.value || aircraft.registration?.value || aircraft.id.toUpperCase()}\n${formatAltitude(aircraft.altBaro?.value, preferences.units)}  ${formatQuantity(aircraft.groundSpeed?.value, "speed", preferences.units)}`,
            }),
          );
          if (
            isSelected &&
            state.follow &&
            time - lastFollow > 500 &&
            fresh !== "lost"
          ) {
            lastFollow = time;
            map.easeTo({
              center: position,
              duration: preferences.reducedMotion ? 0 : 500,
              bearing: preferences.trackUp ? angle : 0,
            });
          }
        }
        for (const id of motion.keys())
          if (!state.aircraft[id]) motion.delete(id);
        (map.getSource("traffic") as GeoJSONSource).setData(
          featureCollection(aircraftFeatures),
        );
        map.getContainer().dataset.aircraftCount = String(
          aircraftFeatures.length,
        );
        map.setLayoutProperty(
          "aircraft",
          "visibility",
          preferences.layers.aircraft ? "visible" : "none",
        );
        map.setLayoutProperty(
          "unknown-track",
          "visibility",
          preferences.layers.aircraft ? "visible" : "none",
        );
        map.setLayoutProperty(
          "aircraft-labels",
          "visibility",
          preferences.layers.labels && preferences.layers.aircraft
            ? "visible"
            : "none",
        );
        const trailFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        if (preferences.layers.trail)
          for (let index = 1; index < state.trail.length; index++) {
            const previous = state.trail[index - 1];
            const current = state.trail[index];
            if (
              current.timestamp < now - preferences.trailMinutes * 60000 ||
              current.timestamp - previous.timestamp > 30000
            )
              continue;
            const value =
              preferences.trailColor === "altitude"
                ? typeof current.altitude === "number"
                  ? current.altitude / 40000
                  : 0
                : preferences.trailColor === "speed"
                  ? (current.speed ?? 0) / 600
                  : ((current.verticalRate ?? 0) + 3000) / 6000;
            const color = `hsl(${170 + Math.min(1, Math.max(0, value)) * 70},65%,43%)`;
            for (const segment of splitAntimeridian([
              previous.coordinate,
              current.coordinate,
            ]))
              trailFeatures.push(
                lineString(segment, { timestamp: current.timestamp, color }),
              );
          }
        (map.getSource("trail") as GeoJSONSource).setData(
          featureCollection(trailFeatures),
        );
        const selected = state.selected ? state.aircraft[state.selected] : null;
        const route = state.route?.value;
        (map.getSource("reference") as GeoJSONSource).setData(
          route && preferences.layers.direct
            ? directRoute(route.origin.coordinate, route.destination.coordinate)
            : empty,
        );
        (map.getSource("route-airports") as GeoJSONSource).setData(
          route
            ? featureCollection([
                point(route.origin.coordinate, {
                  label: route.origin.iata || route.origin.ident,
                }),
                point(route.destination.coordinate, {
                  label: route.destination.iata || route.destination.ident,
                }),
              ])
            : empty,
        );
        const projection =
          selected && preferences.layers.projection && !state.playbackTime
            ? projectedTrack(selected)
            : [];
        (map.getSource("projection") as GeoJSONSource).setData(
          featureCollection(
            splitAntimeridian(projection).map((segment) => lineString(segment)),
          ),
        );
        (map.getSource("rings") as GeoJSONSource).setData(
          selected?.position && preferences.layers.rings
            ? featureCollection(
                [10, 25, 50, 100].map((radius) =>
                  circle(selected.position!.value, radius, {
                    units: "nauticalmiles",
                    steps: 64,
                  }),
                ),
              )
            : empty,
        );
        const cursorTime = state.playbackTime ?? state.hoverTime;
        const cursor = cursorTime
          ? state.trail.reduce(
              (closest, item) =>
                !closest ||
                Math.abs(item.timestamp - cursorTime) <
                  Math.abs(closest.timestamp - cursorTime)
                  ? item
                  : closest,
              state.trail[0],
            )
          : null;
        (map.getSource("cursor") as GeoJSONSource).setData(
          cursor ? point(cursor.coordinate) : empty,
        );
      };
      frame = requestAnimationFrame(paint);
    });
    return () => {
      unsubscribePreferences();
      unsubscribeSelection();
      cancelAnimationFrame(frame);
      mapHandle.current = null;
      map.remove();
    };
  }, [theme]);
  return (
    <div
      ref={container}
      className="live-map"
      aria-label="Live aircraft map"
      role="region"
    />
  );
}
