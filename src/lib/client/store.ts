"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AircraftState,
  Coordinate,
  DataValue,
  Route,
  TrackPoint,
} from "../aviation/model";
import type { UnitSystem } from "../aviation/units";
export const defaultLayers = {
  aircraft: true,
  labels: false,
  trail: true,
  projection: false,
  direct: true,
  airports: false,
  runways: true,
  navaids: false,
  metar: false,
  sigmet: false,
  gairmet: false,
  pirep: false,
  night: false,
  rings: false,
};
export type LayerName = keyof typeof defaultLayers;
export interface Settings {
  foregroundAlerts: boolean;
  browserNotifications: boolean;
  units: UnitSystem;
  timeZone: "UTC" | "local";
  theme: "light" | "dark";
  trackUp: boolean;
  interpolation: boolean;
  reducedMotion: boolean;
  trailMinutes: number;
  trailColor: "altitude" | "speed" | "verticalRate";
  layers: typeof defaultLayers;
}
interface Preferences extends Settings {
  favorites: {
    id: string;
    label: string;
    type: "aircraft" | "flight" | "airport";
  }[];
  recentSearches: string[];
  update: (patch: Partial<Settings>) => void;
  toggleLayer: (layer: LayerName) => void;
  toggleFavorite: (entry: Preferences["favorites"][number]) => void;
  remember: (query: string) => void;
}
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      foregroundAlerts: false,
      browserNotifications: false,
      units: "aviation",
      timeZone: "UTC",
      theme: "light",
      trackUp: false,
      interpolation: true,
      reducedMotion: false,
      trailMinutes: 120,
      trailColor: "altitude",
      layers: defaultLayers,
      favorites: [],
      recentSearches: [],
      update: (patch) => set(patch),
      toggleLayer: (layer) =>
        set((state) => ({
          layers: { ...state.layers, [layer]: !state.layers[layer] },
        })),
      toggleFavorite: (entry) =>
        set((state) => ({
          favorites: state.favorites.some(
            (item) => item.id === entry.id && item.type === entry.type,
          )
            ? state.favorites.filter(
                (item) => !(item.id === entry.id && item.type === entry.type),
              )
            : [...state.favorites, entry],
        })),
      remember: (query) =>
        set((state) => ({
          recentSearches: [
            query,
            ...state.recentSearches.filter((item) => item !== query),
          ].slice(0, 8),
        })),
    }),
    { name: "avitrack-preferences-v1" },
  ),
);
export interface Filter {
  text: string;
  minAltitude: number;
  maxAltitude: number;
  minSpeed: number;
  maxSpeed: number;
  ground: "all" | "airborne" | "ground";
  source: string;
  squawk: string;
  type: string;
  military: boolean;
  pia: boolean;
  ladd: boolean;
}
export const emptyFilter: Filter = {
  text: "",
  minAltitude: -2000,
  maxAltitude: 65000,
  minSpeed: 0,
  maxSpeed: 2000,
  ground: "all",
  source: "",
  squawk: "",
  type: "",
  military: false,
  pia: false,
  ladd: false,
};
interface TrackerState {
  globalCoverage: boolean;
  aircraft: Record<string, AircraftState>;
  selected: string | null;
  follow: boolean;
  view: { center: Coordinate; zoom: number; radius: number; regional: boolean };
  filter: Filter;
  trail: TrackPoint[];
  route: DataValue<Route> | null;
  hoverTime: number | null;
  playbackTime: number | null;
  compare: string[];
  select: (id: string | null) => void;
  merge: (aircraft: AircraftState[], replace?: boolean) => void;
  setView: (view: TrackerState["view"]) => void;
}
export const useTracker = create<TrackerState>((set) => ({
  globalCoverage: false,
  aircraft: {},
  selected: null,
  follow: false,
  view: { center: [-0.2, 51.5], zoom: 7, radius: 120, regional: true },
  filter: emptyFilter,
  trail: [],
  route: null,
  hoverTime: null,
  playbackTime: null,
  compare: [],
  select: (id) =>
    set({
      selected: id,
      follow: false,
      trail: [],
      route: null,
      hoverTime: null,
      playbackTime: null,
    }),
  merge: (incoming, replace = false) =>
    set((state) => {
      const aircraft: Record<string, AircraftState> = replace
        ? Object.fromEntries(
            Object.entries(state.aircraft).filter(
              ([id, item]) =>
                id === state.selected || Date.now() - item.receivedAt < 120000,
            ),
          )
        : { ...state.aircraft };
      for (const item of incoming) {
        const previous = aircraft[item.id];
        if (!previous || item.receivedAt >= previous.receivedAt)
          aircraft[item.id] = item;
      }
      return { aircraft };
    }),
  setView: (view) => set({ view }),
}));
export function matchesFilter(aircraft: AircraftState, filter: Filter) {
  const altitude = aircraft.altBaro?.value;
  const speed = aircraft.groundSpeed?.value;
  const flags =
    typeof aircraft.fields.dbFlags?.value === "number"
      ? aircraft.fields.dbFlags.value
      : 0;
  return (
    (!filter.text ||
      [
        aircraft.id,
        aircraft.callsign?.value,
        aircraft.registration?.value,
        aircraft.aircraftType?.value,
      ].some((value) =>
        value?.toLowerCase().includes(filter.text.toLowerCase()),
      )) &&
    (altitude === "ground" ||
      altitude == null ||
      (altitude >= filter.minAltitude && altitude <= filter.maxAltitude)) &&
    (speed == null || (speed >= filter.minSpeed && speed <= filter.maxSpeed)) &&
    (filter.ground === "all" ||
      (filter.ground === "ground"
        ? altitude === "ground"
        : typeof altitude === "number")) &&
    (!filter.source ||
      aircraft.positionSource.toLowerCase().includes(filter.source)) &&
    (!filter.squawk || aircraft.squawk?.value === filter.squawk) &&
    (!filter.type ||
      aircraft.aircraftType?.value
        ?.toLowerCase()
        .includes(filter.type.toLowerCase())) &&
    (!filter.military || Boolean(flags & 1)) &&
    (!filter.pia || Boolean(flags & 4)) &&
    (!filter.ladd || Boolean(flags & 8))
  );
}
