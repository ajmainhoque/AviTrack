"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNow } from "@/lib/client/clock";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Heart, Plane, X } from "lucide-react";
import {
  usePreferences,
  useTracker,
  defaultLayers,
  emptyFilter,
  matchesFilter,
  type LayerName,
} from "@/lib/client/store";
import { formatAltitude, formatQuantity } from "@/lib/aviation/units";
import { distanceNm, freshness } from "@/lib/aviation/calculations";
import { apiFetch } from "@/lib/client/query";
import type { ProviderHealth } from "@/lib/providers/http";
import { IconButton } from "../common/icon-button";
import { mapHandle } from "@/lib/map/handle";
import { AlertList } from "./foreground-alerts";
export type Panel =
  "layers" | "filters" | "watchlist" | "alerts" | "status" | "settings" | null;
const layerLabels: Record<LayerName, string> = {
  aircraft: "Aircraft",
  labels: "Aircraft labels",
  trail: "Actual observed trajectory",
  projection: "Estimated projected track",
  direct: "Direct route reference",
  airports: "Airports",
  runways: "Runways",
  navaids: "Navaids",
  metar: "METAR flight categories",
  sigmet: "SIGMET advisories",
  gairmet: "G-AIRMET (US)",
  pirep: "PIREP / AIREP",
  night: "Night & twilight",
  rings: "Range rings",
};
export function MapPanels({
  panel,
  close,
}: {
  panel: Panel;
  close: () => void;
}) {
  const preferences = usePreferences();
  const now = useNow();
  const router = useRouter();
  const filter = useTracker((state) => state.filter);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) =>
      apiFetch<{
        providers: ProviderHealth[];
        preferred: string;
        fallback: string;
        refreshMs: number;
        database: boolean;
      }>("/api/health", signal),
    enabled: panel === "status",
    refetchInterval: panel === "status" ? 15000 : false,
  });
  if (!panel) return null;
  const title = {
    layers: "Map layers",
    filters: "Traffic filters",
    watchlist: "Watchlist",
    alerts: "Foreground alerts",
    status: "Data status",
    settings: "Preferences",
  }[panel];
  const updateFilter = (patch: Partial<typeof filter>) =>
    useTracker.setState({ filter: { ...filter, ...patch } });
  return (
    <aside className="tool-panel surface" aria-label={title}>
      <div className="section-heading">
        <h2>{title}</h2>
        <IconButton label={`Close ${title}`} onClick={close}>
          <X size={16} />
        </IconButton>
      </div>
      {panel === "layers" && (
        <>
          <div className="eyebrow">Traffic & navigation</div>
          {(Object.keys(defaultLayers) as LayerName[]).map((layer) => (
            <label className="toggle-row" key={layer}>
              <span>{layerLabels[layer]}</span>
              <input
                type="checkbox"
                checked={preferences.layers[layer]}
                onChange={() => preferences.toggleLayer(layer)}
              />
            </label>
          ))}
          <p className="inline-note">
            Airspace and filed flight plans: no authorized provider configured.
          </p>
        </>
      )}
      {panel === "filters" && (
        <>
          <label className="field-label">
            Callsign / registration / airline prefix
            <input
              value={filter.text}
              onChange={(event) => updateFilter({ text: event.target.value })}
            />
          </label>
          <div className="field-pair">
            <label className="field-label">
              Min altitude (ft)
              <input
                type="number"
                value={filter.minAltitude}
                onChange={(event) =>
                  updateFilter({ minAltitude: Number(event.target.value) })
                }
              />
            </label>
            <label className="field-label">
              Max altitude (ft)
              <input
                type="number"
                value={filter.maxAltitude}
                onChange={(event) =>
                  updateFilter({ maxAltitude: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <div className="field-pair">
            <label className="field-label">
              Min speed (kt)
              <input
                type="number"
                value={filter.minSpeed}
                onChange={(event) =>
                  updateFilter({ minSpeed: Number(event.target.value) })
                }
              />
            </label>
            <label className="field-label">
              Max speed (kt)
              <input
                type="number"
                value={filter.maxSpeed}
                onChange={(event) =>
                  updateFilter({ maxSpeed: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className="field-label">
            State
            <select
              value={filter.ground}
              onChange={(event) =>
                updateFilter({
                  ground: event.target.value as typeof filter.ground,
                })
              }
            >
              <option value="all">All observations</option>
              <option value="airborne">Airborne</option>
              <option value="ground">On ground</option>
            </select>
          </label>
          <label className="field-label">
            Position source
            <select
              value={filter.source}
              onChange={(event) => updateFilter({ source: event.target.value })}
            >
              <option value="">All sources</option>
              <option value="adsb">ADS-B</option>
              <option value="mlat">MLAT</option>
              <option value="tisb">TIS-B</option>
            </select>
          </label>
          <div className="field-pair">
            <label className="field-label">
              Type
              <input
                value={filter.type}
                onChange={(event) => updateFilter({ type: event.target.value })}
              />
            </label>
            <label className="field-label">
              Squawk
              <input
                maxLength={4}
                value={filter.squawk}
                onChange={(event) =>
                  updateFilter({ squawk: event.target.value })
                }
              />
            </label>
          </div>
          {(["military", "pia", "ladd"] as const).map((key) => (
            <label className="toggle-row" key={key}>
              <span>
                {key === "military"
                  ? "Provider-identified military"
                  : `Provider ${key.toUpperCase()} flag`}
              </span>
              <input
                type="checkbox"
                checked={filter[key]}
                onChange={(event) =>
                  updateFilter({ [key]: event.target.checked })
                }
              />
            </label>
          ))}
          <button
            className="button wide"
            onClick={() => useTracker.setState({ filter: emptyFilter })}
          >
            Reset filters
          </button>
        </>
      )}
      {panel === "watchlist" &&
        (preferences.favorites.length ? (
          preferences.favorites.map((entry) => (
            <div className="watchlist-row" key={`${entry.type}:${entry.id}`}>
              <button
                className="text-button"
                onClick={() => {
                  if (entry.type === "airport")
                    router.push(`/airport/${entry.id}`);
                  else useTracker.getState().select(entry.id);
                  close();
                }}
              >
                <Plane size={16} />
                {entry.label}
                <small>{entry.type}</small>
              </button>
              <IconButton
                label={`Remove ${entry.label}`}
                onClick={() => preferences.toggleFavorite(entry)}
              >
                <Heart size={15} fill="currentColor" />
              </IconButton>
            </div>
          ))
        ) : (
          <div className="empty-inline">No saved aircraft or airports.</div>
        ))}
      {panel === "status" && (
        <>
          {health.data ? (
            <>
              <div className="data-row">
                <span>Preferred live source</span>
                <strong>{health.data.preferred}</strong>
              </div>
              <div className="data-row">
                <span>Map refresh</span>
                <strong>{health.data.refreshMs / 1000}s</strong>
              </div>
              <div className="data-row">
                <span>Fallback</span>
                <strong>{health.data.fallback}</strong>
              </div>
              <div className="data-row">
                <span>PostgreSQL</span>
                <strong>
                  {health.data.database
                    ? "Configured"
                    : "Local reference files"}
                </strong>
              </div>
              {health.data.providers.map((provider) => (
                <section key={provider.provider}>
                  <div className="section-heading">
                    <h3>{provider.provider}</h3>
                    <span className={`source-badge ${provider.status}`}>
                      {provider.status}
                    </span>
                  </div>
                  <dl className="data-list">
                    <div>
                      <dt>Latency</dt>
                      <dd>
                        {provider.latency == null
                          ? "Not available"
                          : `${provider.latency} ms`}
                      </dd>
                    </div>
                    <div>
                      <dt>Last success</dt>
                      <dd>
                        {provider.lastSuccess
                          ? new Date(provider.lastSuccess).toLocaleTimeString()
                          : "Not yet"}
                      </dd>
                    </div>
                    <div>
                      <dt>Requests / cache hits</dt>
                      <dd>
                        {provider.requests} / {provider.cacheHits}
                      </dd>
                    </div>
                    {provider.retryAt > now && (
                      <div>
                        <dt>Cooldown until</dt>
                        <dd>
                          {new Date(provider.retryAt).toLocaleTimeString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
              ))}
            </>
          ) : (
            <p className="inline-note">
              {health.error ? "Status unavailable" : "Checking sources..."}
            </p>
          )}
        </>
      )}
      {panel === "settings" && <SettingsFields />}
      {panel === "alerts" && <AlertList />}
    </aside>
  );
}
export function SettingsFields() {
  const preferences = usePreferences();
  return (
    <>
      <label className="field-label">
        Units
        <select
          value={preferences.units}
          onChange={(event) =>
            preferences.update({
              units: event.target.value as typeof preferences.units,
            })
          }
        >
          <option value="aviation">Aviation (ft, kt, NM)</option>
          <option value="metric">Metric (m, km/h, km)</option>
          <option value="us">US (ft, mph, mi)</option>
        </select>
      </label>
      <label className="field-label">
        Time
        <select
          value={preferences.timeZone}
          onChange={(event) =>
            preferences.update({
              timeZone: event.target.value as "UTC" | "local",
            })
          }
        >
          <option value="UTC">UTC</option>
          <option value="local">Device local</option>
        </select>
      </label>
      <label className="field-label">
        Map & interface
        <select
          value={preferences.theme}
          onChange={(event) =>
            preferences.update({
              theme: event.target.value as "light" | "dark",
            })
          }
        >
          <option value="light">Daylight</option>
          <option value="dark">Night</option>
        </select>
      </label>
      <label className="field-label">
        Trail colour
        <select
          value={preferences.trailColor}
          onChange={(event) =>
            preferences.update({
              trailColor: event.target.value as typeof preferences.trailColor,
            })
          }
        >
          <option value="altitude">Altitude</option>
          <option value="speed">Groundspeed</option>
          <option value="verticalRate">Vertical rate</option>
        </select>
      </label>
      <label className="field-label">
        Trail duration
        <select
          value={preferences.trailMinutes}
          onChange={(event) =>
            preferences.update({ trailMinutes: Number(event.target.value) })
          }
        >
          {[15, 30, 60, 120, 360].map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </label>
      {(["trackUp", "interpolation", "reducedMotion"] as const).map((key) => (
        <label key={key} className="toggle-row">
          <span>
            {
              {
                trackUp: "Track-up follow",
                interpolation: "Smooth aircraft movement",
                reducedMotion: "Reduce motion",
              }[key]
            }
          </span>
          <input
            type="checkbox"
            checked={preferences[key]}
            onChange={(event) =>
              preferences.update({ [key]: event.target.checked })
            }
          />
        </label>
      ))}
    </>
  );
}
export function FlightTable({ close }: { close: () => void }) {
  const aircraft = useTracker((state) => state.aircraft);
  const filter = useTracker((state) => state.filter);
  const selected = useTracker((state) => state.selected);
  const units = usePreferences((state) => state.units);
  const [sort, setSort] = useState("callsign");
  const [descending, setDescending] = useState(false);
  const [scroll, setScroll] = useState(0);
  const rows = Object.values(aircraft)
    .filter((item) => matchesFilter(item, filter))
    .sort((left, right) => {
      const value = (item: typeof left) =>
        sort === "altitude"
          ? typeof item.altBaro?.value === "number"
            ? item.altBaro.value
            : -1
          : sort === "speed"
            ? (item.groundSpeed?.value ?? -1)
            : (item.callsign?.value ?? item.id);
      const first = value(left);
      const second = value(right);
      return (
        (typeof first === "number" && typeof second === "number"
          ? first - second
          : String(first).localeCompare(String(second))) * (descending ? -1 : 1)
      );
    });
  const start = Math.max(0, Math.floor(scroll / 36) - 2);
  const visible = rows.slice(start, start + 12);
  return (
    <section
      className="traffic-table surface"
      aria-label="Observed aircraft table"
    >
      <div className="section-heading">
        <h2>
          Observed traffic <span className="small-mono">{rows.length}</span>
        </h2>
        <IconButton label="Close traffic table" onClick={close}>
          <X size={16} />
        </IconButton>
      </div>
      <div
        className="table-scroll"
        onScroll={(event) => setScroll(event.currentTarget.scrollTop)}
      >
        <table>
          <thead>
            <tr>
              {[
                "callsign",
                "registration",
                "type",
                "altitude",
                "speed",
                "vertical rate",
                "track",
                "squawk",
                "source",
                "position",
              ].map((column) => (
                <th key={column}>
                  {["callsign", "altitude", "speed"].includes(column) ? (
                    <button
                      onClick={() => {
                        setSort(column);
                        setDescending(sort === column ? !descending : false);
                      }}
                    >
                      {column}
                      {sort === column &&
                        (descending ? (
                          <ArrowDown size={11} />
                        ) : (
                          <ArrowUp size={11} />
                        ))}
                    </button>
                  ) : (
                    column
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {start > 0 && (
              <tr aria-hidden="true">
                <td colSpan={10} style={{ height: start * 36, padding: 0 }} />
              </tr>
            )}
            {visible.map((item) => (
              <tr
                key={item.id}
                className={selected === item.id ? "selected" : ""}
                onClick={() => {
                  useTracker.getState().select(item.id);
                  if (item.position)
                    mapHandle.current?.easeTo({ center: item.position.value });
                }}
              >
                <td>
                  <button
                    className="text-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      useTracker.getState().select(item.id);
                    }}
                  >
                    {item.callsign?.value || item.id.toUpperCase()}
                  </button>
                </td>
                <td>{item.registration?.value || "N/A"}</td>
                <td>{item.aircraftType?.value || "N/A"}</td>
                <td>{formatAltitude(item.altBaro?.value, units)}</td>
                <td>
                  {formatQuantity(item.groundSpeed?.value, "speed", units)}
                </td>
                <td>
                  {formatQuantity(
                    item.verticalRate?.value,
                    "verticalRate",
                    units,
                  )}
                </td>
                <td>{item.track?.value.toFixed(0) ?? "N/A"}</td>
                <td>{item.squawk?.value || "N/A"}</td>
                <td>{item.positionSource}</td>
                <td>{freshness(item.position?.observedAt ?? null)}</td>
              </tr>
            ))}
            {rows.length > start + 12 && (
              <tr aria-hidden="true">
                <td
                  colSpan={10}
                  style={{
                    height: (rows.length - start - 12) * 36,
                    padding: 0,
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function Compare() {
  const selected = useTracker((state) => state.compare);
  const aircraft = useTracker((state) => state.aircraft);
  const units = usePreferences((state) => state.units);
  if (!selected.length) return null;
  return (
    <aside className="compare-panel surface">
      <div className="section-heading">
        <h2>Compare observations</h2>
        <IconButton
          label="Close comparison"
          onClick={() => useTracker.setState({ compare: [] })}
        >
          <X size={15} />
        </IconButton>
      </div>
      {selected.map((id, index) => {
        const current = aircraft[id];
        const previous = aircraft[selected[Math.max(0, index - 1)]];
        return (
          <div className="compare-row" key={id}>
            <button
              className="text-button"
              onClick={() => useTracker.getState().select(id)}
            >
              {current?.callsign?.value || id}
            </button>
            <span>{formatAltitude(current?.altBaro?.value, units)}</span>
            <span>
              {formatQuantity(current?.groundSpeed?.value, "speed", units)}
            </span>
            {index > 0 && current?.position && previous?.position && (
              <small>
                {formatQuantity(
                  distanceNm(previous.position.value, current.position.value),
                  "distance",
                  units,
                )}{" "}
                from {previous.callsign?.value || previous.id}
              </small>
            )}
          </div>
        );
      })}
    </aside>
  );
}
