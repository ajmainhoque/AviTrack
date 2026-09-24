"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/client/query";
import { usePreferences, useTracker } from "@/lib/client/store";
import {
  appendObservation,
  loadTracks,
  observation,
  saveTrack,
} from "@/lib/client/history";
import type { AircraftSnapshot, TrackPoint } from "@/lib/aviation/model";
export interface ClientConfig {
  provider: string;
  refreshMs: number;
  selectedRefreshMs: number;
  global: boolean;
  weather: boolean;
  schedule: boolean;
  stream?: boolean;
}
export function useLive() {
  const view = useTracker((state) => state.view);
  const selected = useTracker((state) => state.selected);
  const merge = useTracker((state) => state.merge);
  const configuration = useQuery({
    queryKey: ["config"],
    queryFn: ({ signal }) => apiFetch<ClientConfig>("/api/config", signal),
    staleTime: Infinity,
  });
  const config = configuration.data;
  const regional = useQuery({
    queryKey: [
      "live",
      Math.round(view.center[1] * 20) / 20,
      Math.round(view.center[0] * 20) / 20,
      Math.ceil(view.radius / 10) * 10,
      view.regional,
    ],
    queryFn: ({ signal }) =>
      apiFetch<AircraftSnapshot>(
        view.regional
          ? `/api/live?lat=${view.center[1]}&lon=${view.center[0]}&radius=${view.radius}`
          : "/api/live?global=true",
        signal,
      ),
    enabled:
      Boolean(config) &&
      !config?.stream &&
      (view.regional || Boolean(config?.global)),
    refetchInterval: (query) =>
      query.state.error instanceof ApiError
        ? Math.max(
            config?.refreshMs ?? 5000,
            query.state.error.retryAfter * 1000,
          )
        : (config?.refreshMs ?? 5000),
  });
  const chosen = useQuery({
    queryKey: ["aircraft", selected],
    queryFn: ({ signal }) =>
      apiFetch<AircraftSnapshot>(
        `/api/live?id=${encodeURIComponent(selected!)}`,
        signal,
      ),
    enabled: Boolean(selected && config),
    refetchInterval: (query) =>
      query.state.error instanceof ApiError
        ? Math.max(
            config?.selectedRefreshMs ?? 2500,
            query.state.error.retryAfter * 1000,
          )
        : (config?.selectedRefreshMs ?? 2500),
  });
  useEffect(() => {
    if (regional.data) merge(regional.data.aircraft, true);
  }, [regional.data, merge]);
  const streamLatitude = Math.round(view.center[1]);
  const streamLongitude = Math.round(view.center[0]);
  useEffect(() => {
    useTracker.setState({ globalCoverage: Boolean(config?.global) });
    if (!config?.stream || (!view.regional && !config.global)) return;
    let stream: EventSource | null = null;
    const connect = () => {
      stream?.close();
      stream = null;
      if (document.hidden) return;
      stream = new EventSource(
        view.regional
          ? `/api/live-stream?lat=${streamLatitude}&lon=${streamLongitude}`
          : "/api/live-stream?global=true",
      );
      stream.onmessage = (event) => {
        try {
          const snapshot = JSON.parse(event.data) as AircraftSnapshot;
          if (!Array.isArray(snapshot.aircraft)) return;
          useTracker.setState((state) => ({
            aircraft: {
              ...(state.selected && state.aircraft[state.selected]
                ? { [state.selected]: state.aircraft[state.selected] }
                : {}),
              ...Object.fromEntries(
                snapshot.aircraft.map((aircraft) => [aircraft.id, aircraft]),
              ),
            },
          }));
        } catch {
          stream?.close();
        }
      };
    };
    connect();
    document.addEventListener("visibilitychange", connect);
    return () => {
      stream?.close();
      document.removeEventListener("visibilitychange", connect);
    };
  }, [
    config?.stream,
    config?.global,
    view.regional,
    streamLatitude,
    streamLongitude,
  ]);
  useEffect(() => {
    if (chosen.data) merge(chosen.data.aircraft);
  }, [chosen.data, merge]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    let captured: TrackPoint[] = [];
    const initialAircraft = useTracker.getState().aircraft[selected];
    const firstPoint = initialAircraft ? observation(initialAircraft) : null;
    if (firstPoint) {
      captured = appendObservation([], firstPoint);
      useTracker.setState({ trail: captured });
    }
    loadTracks(selected)
      .then((tracks) => {
        if (!active || useTracker.getState().trail.length > 1) return;
        const latest = tracks[0];
        if (latest && Date.now() - latest.updatedAt < 30 * 60000) {
          captured = firstPoint
            ? appendObservation(latest.points, firstPoint)
            : latest.points;
          useTracker.setState({ trail: captured });
        }
      })
      .catch(() => undefined);
    const unsubscribe = useTracker.subscribe((state, previous) => {
      if (state.selected !== selected) return;
      const aircraft = state.aircraft[selected];
      if (!aircraft || aircraft === previous.aircraft[selected]) return;
      const next = observation(aircraft);
      if (!next) return;
      const trail = appendObservation(state.trail, next);
      captured = trail;
      if (trail !== state.trail) useTracker.setState({ trail });
    });
    const timer = setInterval(() => {
      const points = useTracker.getState().trail;
      const bookmarked = usePreferences
        .getState()
        .favorites.some((item) => item.id === selected);
      saveTrack(points, bookmarked).catch(() => undefined);
    }, 10000);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
      saveTrack(
        captured,
        usePreferences
          .getState()
          .favorites.some((item) => item.id === selected),
      ).catch(() => undefined);
    };
  }, [selected]);
  return { regional, chosen, config };
}
