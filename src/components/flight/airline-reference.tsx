"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "@/lib/client/query";
import { useTracker } from "@/lib/client/store";
import type { Airline, DataValue } from "@/lib/aviation/model";
export function AirlineReference({ code }: { code: string }) {
  const result = useQuery({
    queryKey: ["airline", code],
    queryFn: ({ signal }) =>
      apiFetch<{ data: DataValue<Airline[]> | null }>(
        `/api/enrichment?kind=airline&id=${code}`,
        signal,
      ),
    staleTime: 86400000,
  });
  const aircraft = useTracker((state) => state.aircraft);
  return (
    <>
      <div className="eyebrow">AIRLINE REFERENCE</div>
      <h1>{result.data?.data?.value[0]?.name || code}</h1>
      {result.isFetching && <p>Loading airline reference...</p>}
      {!result.isFetching && !result.data?.data && (
        <p>Airline information not available for this code.</p>
      )}
      {result.data?.data?.value.map((airline) => (
        <section key={airline.icao}>
          <h2>{airline.name}</h2>
          <dl className="data-list">
            {Object.entries({
              IATA: airline.iata,
              ICAO: airline.icao,
              Callsign: airline.callsign,
              Country: airline.country,
            }).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value || "Not available"}</dd>
              </div>
            ))}
          </dl>
          <p className="inline-note">
            ADSBDB / enriched / received{" "}
            {new Date(result.data!.data!.receivedAt).toISOString()}
          </p>
          <h3>Currently observed in this browser session</h3>
          {Object.values(aircraft)
            .filter((item) => item.callsign?.value.startsWith(airline.icao))
            .map((item) => (
              <p key={item.id}>
                <Link href={`/flight/${item.id}`}>
                  {item.callsign?.value} / {item.registration?.value || item.id}
                </Link>
              </p>
            ))}
          <p>Regional observations are not a complete fleet or schedule.</p>
        </section>
      ))}
    </>
  );
}
