"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/query";
import { Tracker } from "../map/tracker";
import { PageShell } from "../common/page-shell";
import type { SearchResult } from "../map/search";
export function FlightEntry({ identifier }: { identifier: string }) {
  const isHex = /^~?[a-f0-9]{6}$/i.test(identifier);
  const result = useQuery({
    queryKey: ["flight-resolve", identifier],
    queryFn: ({ signal }) =>
      apiFetch<{ results: SearchResult[] }>(
        `/api/search?q=${encodeURIComponent(identifier)}`,
        signal,
      ),
    enabled: !isHex,
    staleTime: 30000,
  });
  const aircraft =
    result.data?.results.filter((result) => result.aircraft) ?? [];
  if (isHex || aircraft.length === 1)
    return (
      <Tracker
        initialIdentifier={isHex ? identifier.toLowerCase() : aircraft[0].id}
      />
    );
  return (
    <PageShell>
      <div className="eyebrow">FLIGHT LOOKUP</div>
      <h1>{identifier.toUpperCase()}</h1>
      {result.isFetching ? (
        <p>Resolving current observations...</p>
      ) : aircraft.length ? (
        <>
          <p>
            Multiple current matches. Callsigns and flight numbers are not
            permanent flight identities.
          </p>
          {aircraft.map((item) => (
            <p key={item.id}>
              <Link className="button" href={`/map?aircraft=${item.id}`}>
                {item.label} / {item.detail}
              </Link>
            </p>
          ))}
        </>
      ) : (
        <p>
          {result.error
            ? "Live lookup temporarily unavailable."
            : "No current aircraft observation matches this identifier. This does not establish whether a flight is cancelled, landed, or scheduled."}
        </p>
      )}
      <Link className="button" href="/map">
        Return to live map
      </Link>
    </PageShell>
  );
}
