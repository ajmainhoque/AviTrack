"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Popup, type GeoJSONSource } from "maplibre-gl";
import { usePreferences, useTracker } from "@/lib/client/store";
import { apiFetch } from "@/lib/client/query";
import type { DataValue } from "@/lib/aviation/model";
import { mapHandle } from "@/lib/map/handle";
import { nightOverlay } from "@/lib/map/night";
interface References {
  airports: GeoJSON.FeatureCollection;
  runways: GeoJSON.FeatureCollection;
  navaids: GeoJSON.FeatureCollection;
  syncedAt?: number;
  source?: string;
}
const empty: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
export function ReferenceLayers() {
  const layers = usePreferences((state) => state.layers);
  const view = useTracker((state) => state.view);
  const router = useRouter();
  const [ready, setReady] = useState(0);
  const latitude = Math.round(view.center[1] * 4) / 4;
  const longitude = Math.round(view.center[0] * 4) / 4;
  const references = useQuery({
    queryKey: ["map-reference", latitude, longitude, view.regional],
    queryFn: ({ signal }) =>
      apiFetch<References>(
        view.regional
          ? `/api/map-reference?lat=${latitude}&lon=${longitude}&radius=250`
          : "/api/map-reference?overview=true",
        signal,
      ),
    enabled:
      layers.airports || layers.runways || layers.navaids || !view.regional,
    staleTime: 3600000,
  });
  const metar = useQuery({
    queryKey: ["weather-map", "metar"],
    queryFn: ({ signal }) =>
      apiFetch<DataValue<GeoJSON.FeatureCollection>>(
        "/api/weather?product=metar",
        signal,
      ),
    enabled: layers.metar,
    staleTime: 120000,
    refetchInterval: layers.metar ? 180000 : false,
  });
  const sigmet = useQuery({
    queryKey: ["weather-map", "sigmet"],
    queryFn: async ({ signal }) => {
      const results = await Promise.allSettled([
        apiFetch<DataValue<GeoJSON.FeatureCollection>>(
          "/api/weather?product=sigmet",
          signal,
        ),
        apiFetch<DataValue<GeoJSON.FeatureCollection>>(
          "/api/weather?product=isigmet",
          signal,
        ),
      ]);
      const successful = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      if (!successful.length) throw new Error("SIGMET unavailable");
      return {
        data: {
          type: "FeatureCollection" as const,
          features: successful.flatMap((result) => result.value.features),
        },
        partial: successful.length < 2,
      };
    },
    enabled: layers.sigmet,
    staleTime: 120000,
    refetchInterval: layers.sigmet ? 180000 : false,
  });
  const gairmet = useQuery({
    queryKey: ["weather-map", "gairmet"],
    queryFn: ({ signal }) =>
      apiFetch<DataValue<GeoJSON.FeatureCollection>>(
        "/api/weather?product=gairmet",
        signal,
      ),
    enabled: layers.gairmet,
    staleTime: 600000,
    refetchInterval: layers.gairmet ? 600000 : false,
  });
  const bounding = `${Math.max(-90, latitude - 4)},${Math.max(-180, longitude - 6)},${Math.min(90, latitude + 4)},${Math.min(180, longitude + 6)}`;
  const pirep = useQuery({
    queryKey: ["weather-map", "pirep", bounding],
    queryFn: ({ signal }) =>
      apiFetch<DataValue<GeoJSON.FeatureCollection>>(
        `/api/weather?product=pirep&bbox=${bounding}`,
        signal,
      ),
    enabled: layers.pirep && view.regional,
    staleTime: 180000,
    refetchInterval: layers.pirep ? 300000 : false,
  });
  useEffect(() => {
    let attached: typeof mapHandle.current = null;
    const timer = setInterval(() => {
      const map = mapHandle.current;
      if (!map || map === attached || !map.getLayer("aircraft")) return;
      attached = map;
      for (const id of [
        "airports",
        "runways",
        "navaids",
        "metar",
        "sigmet",
        "gairmet",
        "pirep",
        "night",
      ])
        if (!map.getSource(`overlay-${id}`))
          map.addSource(`overlay-${id}`, { type: "geojson", data: empty });
      map.addLayer(
        {
          id: "overlay-night",
          type: "fill",
          source: "overlay-night",
          paint: { "fill-color": "#25294a", "fill-opacity": 0.12 },
        },
        "rings-line",
      );
      for (const product of ["sigmet", "gairmet"]) {
        map.addLayer(
          {
            id: `overlay-${product}-fill`,
            type: "fill",
            source: `overlay-${product}`,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: {
              "fill-color": product === "sigmet" ? "#d5893f" : "#9e78ad",
              "fill-opacity": 0.17,
            },
          },
          "aircraft",
        );
        map.addLayer(
          {
            id: `overlay-${product}-line`,
            type: "line",
            source: `overlay-${product}`,
            paint: {
              "line-color": product === "sigmet" ? "#c27026" : "#9461a1",
              "line-width": 1.5,
            },
          },
          "aircraft",
        );
      }
      map.addLayer(
        {
          id: "overlay-runways",
          type: "line",
          source: "overlay-runways",
          minzoom: 10,
          paint: { "line-color": "#317d75", "line-width": 4 },
        },
        "aircraft",
      );
      map.addLayer(
        {
          id: "overlay-airports",
          type: "circle",
          source: "overlay-airports",
          paint: {
            "circle-radius": 4,
            "circle-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#257b79",
          },
        },
        "aircraft",
      );
      map.addLayer(
        {
          id: "overlay-airport-label",
          type: "symbol",
          source: "overlay-airports",
          layout: {
            "text-field": ["get", "label"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 10,
            "text-offset": [0, 1.3],
          },
          paint: {
            "text-color": "#257b79",
            "text-halo-color": "white",
            "text-halo-width": 2,
          },
        },
        "aircraft",
      );
      map.addLayer(
        {
          id: "overlay-navaids",
          type: "circle",
          source: "overlay-navaids",
          minzoom: 8,
          paint: {
            "circle-radius": 4,
            "circle-color": "#8872a8",
            "circle-stroke-color": "white",
            "circle-stroke-width": 1,
          },
        },
        "aircraft",
      );
      map.addLayer(
        {
          id: "overlay-metar",
          type: "circle",
          source: "overlay-metar",
          paint: {
            "circle-radius": 6,
            "circle-color": [
              "match",
              ["get", "category"],
              "VFR",
              "#2b9b79",
              "MVFR",
              "#3488c2",
              "IFR",
              "#c84259",
              "LIFR",
              "#9d4f99",
              "#888888",
            ],
            "circle-stroke-width": 1,
            "circle-stroke-color": "white",
          },
        },
        "aircraft",
      );
      map.addLayer(
        {
          id: "overlay-pirep",
          type: "circle",
          source: "overlay-pirep",
          paint: {
            "circle-radius": 5,
            "circle-color": "#d38b31",
            "circle-stroke-color": "white",
            "circle-stroke-width": 1,
          },
        },
        "aircraft",
      );
      map.on("click", "overlay-airports", (event) => {
        const ident = event.features?.[0]?.properties?.ident;
        if (typeof ident === "string")
          router.push(`/airport/${encodeURIComponent(ident)}`);
      });
      for (const layer of [
        "overlay-metar",
        "overlay-pirep",
        "overlay-sigmet-fill",
        "overlay-gairmet-fill",
        "overlay-navaids",
      ])
        map.on("click", layer, (event) => {
          const properties: Record<string, unknown> =
            event.features?.[0]?.properties ?? {};
          const content = document.createElement("div");
          content.style.maxWidth = "300px";
          content.style.fontSize = "11px";
          content.textContent = Object.entries(properties)
            .slice(0, 24)
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join("\n");
          content.style.whiteSpace = "pre-wrap";
          new Popup().setLngLat(event.lngLat).setDOMContent(content).addTo(map);
        });
      setReady((value) => value + 1);
    }, 500);
    return () => clearInterval(timer);
  }, [router]);
  useEffect(() => {
    const map = mapHandle.current;
    if (!map?.getSource("overlay-airports")) return;
    const set = (
      name: string,
      data: GeoJSON.FeatureCollection | undefined,
      visible: boolean,
    ) =>
      (map.getSource(`overlay-${name}`) as GeoJSONSource).setData(
        visible && data ? data : empty,
      );
    set(
      "airports",
      references.data?.airports,
      layers.airports || !view.regional,
    );
    set("runways", references.data?.runways, layers.runways);
    set("navaids", references.data?.navaids, layers.navaids);
    set("metar", metar.data?.value, layers.metar);
    set("sigmet", sigmet.data?.data, layers.sigmet);
    set("gairmet", gairmet.data?.value, layers.gairmet);
    set("pirep", pirep.data?.value, layers.pirep);
    const updateNight = () =>
      set(
        "night",
        layers.night ? nightOverlay(Date.now()) : empty,
        layers.night,
      );
    updateNight();
    const timer = setInterval(updateNight, 60000);
    return () => clearInterval(timer);
  }, [
    ready,
    references.data,
    metar.data,
    sigmet.data,
    gairmet.data,
    pirep.data,
    layers,
    view.regional,
  ]);
  const errors = [
    references.error ? "Airport reference unavailable" : "",
    metar.error && layers.metar ? "METAR layer unavailable" : "",
    sigmet.error && layers.sigmet ? "SIGMET layer unavailable" : "",
    sigmet.data?.partial && layers.sigmet ? "SIGMET coverage partial" : "",
    gairmet.error && layers.gairmet ? "G-AIRMET unavailable" : "",
    pirep.error && layers.pirep ? "PIREP unavailable" : "",
  ].filter(Boolean);
  return errors.length ? (
    <div className="overlay-status surface" role="status">
      {errors.join(" / ")}
    </div>
  ) : null;
}
