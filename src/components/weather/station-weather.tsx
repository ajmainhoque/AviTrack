"use client";
import { useQuery } from "@tanstack/react-query";
import { Cloud, Wind } from "lucide-react";
import { apiFetch } from "@/lib/client/query";
import { usePreferences } from "@/lib/client/store";
import { useNow } from "@/lib/client/clock";
import { formatQuantity, formatTime } from "@/lib/aviation/units";
import type { StationWeather } from "@/lib/providers/weather";
export function StationWeatherView({
  station,
  compact = false,
}: {
  station: string;
  compact?: boolean;
}) {
  const result = useQuery({
    queryKey: ["weather", station],
    queryFn: ({ signal }) =>
      apiFetch<StationWeather>(`/api/weather?station=${station}`, signal),
    staleTime: 120000,
    refetchInterval: 300000,
  });
  const now = useNow();
  const units = usePreferences((state) => state.units);
  const zone = usePreferences((state) => state.timeZone);
  const metar = result.data?.metar;
  const taf = result.data?.taf;
  const report = metar?.value;
  const ceiling = report?.clouds
    ?.filter(
      (cloud) =>
        ["BKN", "OVC", "VV"].includes(cloud.cover) && cloud.base != null,
    )
    .reduce((lowest, cloud) => Math.min(lowest, cloud.base!), Infinity);
  return (
    <div className={compact ? "compact-weather" : "station-weather"}>
      <div className="section-heading">
        <h2>
          <Cloud size={14} style={{ display: "inline", marginRight: 7 }} />
          {station} weather
        </h2>
        {report?.fltCat && (
          <span
            className="weather-category"
            title="AWC flight category, based on US ceiling/visibility thresholds"
          >
            {report.fltCat}
          </span>
        )}
      </div>
      {result.isLoading && <div className="skeleton" />}
      {result.error && (
        <p className="inline-note">
          Aviation weather unavailable. Tracking is unaffected.
        </p>
      )}
      {report ? (
        <>
          <div className="weather-grid">
            <div>
              <small>WIND</small>
              <strong>
                <Wind size={12} style={{ display: "inline" }} />{" "}
                {report.wdir ?? "Variable"}{" "}
                {formatQuantity(report.wspd, "speed", units)}
                {report.wgst != null
                  ? ` G${formatQuantity(report.wgst, "speed", units)}`
                  : ""}
              </strong>
            </div>
            <div>
              <small>VISIBILITY (STATUTE MILES)</small>
              <strong>{report.visib ?? "Not available"}</strong>
            </div>
            <div>
              <small>CEILING</small>
              <strong>
                {ceiling === Infinity
                  ? "None reported"
                  : formatQuantity(ceiling, "altitude", units)}
              </strong>
            </div>
            <div>
              <small>TEMPERATURE / DEW POINT</small>
              <strong>
                {formatQuantity(report.temp, "temperature", units)} /{" "}
                {formatQuantity(report.dewp, "temperature", units)}
              </strong>
            </div>
            <div>
              <small>QNH</small>
              <strong>{formatQuantity(report.altim, "pressure", units)}</strong>
            </div>
            <div>
              <small>OBSERVED</small>
              <strong>{formatTime(report.obsTime * 1000, zone)}</strong>
            </div>
          </div>
          <p className="inline-note">
            {metar?.source} / observed{" "}
            {Math.max(0, Math.floor((now - report.obsTime * 1000) / 60000))} min
            ago{now - report.obsTime * 1000 > 5400000 ? " / Stale" : ""}
          </p>
          {!compact && (
            <>
              <p className="weather-raw">{report.rawOb}</p>
              <dl className="data-list">
                {report.clouds?.map((cloud, index) => (
                  <div key={index}>
                    <dt>{cloud.cover}</dt>
                    <dd>{formatQuantity(cloud.base, "altitude", units)} AGL</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </>
      ) : (
        !result.isLoading && (
          <p className="inline-note">No current METAR available.</p>
        )
      )}
      {!compact && (
        <>
          <h3 style={{ marginTop: 25 }}>Terminal aerodrome forecast</h3>
          {taf ? (
            <>
              <p className="inline-note">
                {taf.source} / issued{" "}
                {taf.observedAt
                  ? formatTime(taf.observedAt, zone)
                  : "Time not supplied"}
              </p>
              <p className="weather-raw">{taf.value.rawTAF}</p>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Change</th>
                      <th>Wind</th>
                      <th>Visibility (SM)</th>
                      <th>Clouds (ft AGL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taf.value.fcsts.map((period, index) => (
                      <tr key={index}>
                        <td>
                          {period.timeFrom
                            ? formatTime(period.timeFrom * 1000, zone)
                            : "N/A"}{" "}
                          -{" "}
                          {period.timeTo
                            ? formatTime(period.timeTo * 1000, zone)
                            : "N/A"}
                        </td>
                        <td>{period.fcstChange || "Baseline"}</td>
                        <td>
                          {period.wdir ?? "VRB"} /{" "}
                          {formatQuantity(period.wspd, "speed", units)}
                        </td>
                        <td>{period.visib ?? "N/A"}</td>
                        <td>
                          {period.clouds
                            ?.map(
                              (cloud) => `${cloud.cover} ${cloud.base ?? ""}`,
                            )
                            .join(", ") || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="inline-note">TAF not available.</p>
          )}
        </>
      )}
      {result.data?.errors.map((error) => (
        <p className="inline-note" key={error}>
          {error}
        </p>
      ))}
    </div>
  );
}
