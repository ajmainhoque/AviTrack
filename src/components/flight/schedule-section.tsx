"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/query";
import type { DataValue } from "@/lib/aviation/model";
import type { ScheduleRecord } from "@/lib/providers/contracts";
import { usePreferences } from "@/lib/client/store";
import { formatTime } from "@/lib/aviation/units";
import type { ClientConfig } from "../map/use-live";
export function AirportSchedules({ airport }: { airport: string }) {
  const [direction, setDirection] = useState<"arrival" | "departure">("departure");
  const configuration = useQuery({ queryKey: ["config"], queryFn: ({ signal }) => apiFetch<ClientConfig>("/api/config", signal), staleTime: Infinity });
  if (!configuration.data?.schedule) return null;
  return <section><h2>Supplier schedules</h2><div className="tabs" role="tablist" aria-label="Airport schedule direction"><button role="tab" aria-selected={direction === "departure"} onClick={() => setDirection("departure")}>Departures</button><button role="tab" aria-selected={direction === "arrival"} onClick={() => setDirection("arrival")}>Arrivals</button></div><ScheduleSection airport={airport} direction={direction} /></section>;
}
export function ScheduleSection({
  callsign,
  airport,
  direction = "departure",
}: {
  callsign?: string;
  airport?: string;
  direction?: "arrival" | "departure";
}) {
  const configuration = useQuery({
    queryKey: ["config"],
    queryFn: ({ signal }) => apiFetch<ClientConfig>("/api/config", signal),
    staleTime: Infinity,
  });
  const query = airport
    ? `airport=${airport}&direction=${direction}`
    : `flight=${encodeURIComponent(callsign || "")}`;
  const result = useQuery({
    queryKey: ["schedule", query],
    queryFn: ({ signal }) =>
      apiFetch<{
        configured: boolean;
        data: DataValue<ScheduleRecord[]> | null;
      }>(`/api/schedule?${query}&explicit=true`, signal),
    enabled: Boolean(configuration.data?.schedule && (airport || callsign)),
    staleTime: airport ? 180000 : 60000,
  });
  const zone = usePreferences((state) => state.timeZone);
  if (!configuration.data?.schedule)
    return (
      <p className="inline-note">
        Schedule provider not configured. ADS-B is not airline status data.
      </p>
    );
  return (
    <div className="schedule-section">
      <div className="section-heading">
        <h3>
          {airport ? `Supplier ${direction} board` : "Supplier flight records"}
        </h3>
        <span className="source-badge">AirLabs / Reported</span>
      </div>
      {result.isFetching && <p className="inline-note">Loading schedule...</p>}
      {result.error && <p className="inline-note">{result.error.message}</p>}
      {result.data?.data?.value.length
        ? result.data.data.value.map((record, index) => (
            <details key={`${record.flightNumber}:${record.date}:${index}`}>
              <summary>
                {record.marketingFlight || record.flightNumber} /{" "}
                {record.date || "Date unavailable"} /{" "}
                {record.status || "Status unavailable"}
              </summary>
              <p className="inline-note">
                Separate supplier record. Identity match is not assumed from
                callsign alone.
              </p>
              <div className="data-row">
                <span>Route</span>
                <strong>
                  {record.origin || "Unknown"} to{" "}
                  {record.destination || "Unknown"}
                </strong>
              </div>
              {record.operatingFlight && (
                <div className="data-row">
                  <span>Codeshare</span>
                  <strong>{record.operatingFlight}</strong>
                </div>
              )}
              {(["departure", "arrival"] as const).map((direction) => (
                <div key={direction}>
                  <h3>{direction === "departure" ? "Departure" : "Arrival"}</h3>
                  <dl className="data-list">
                    {Object.entries(record[direction])
                      .filter(([, value]) => value !== null)
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>
                            {["scheduled", "estimated", "actual"].includes(key)
                              ? `${new Date(value!).toISOString().slice(0, 10)} ${formatTime(Date.parse(value!), zone)}`
                              : value}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ))}
            </details>
          ))
        : !result.isFetching && (
            <p className="inline-note">
              No schedule records available within the provider&apos;s time
              window.
            </p>
          )}
      <p className="inline-note">
        {result.data?.data
          ? `AirLabs / received ${new Date(result.data.data.receivedAt).toISOString()}`
          : ""}
      </p>
    </div>
  );
}
