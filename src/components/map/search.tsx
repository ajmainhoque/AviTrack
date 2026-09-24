"use client";
import { useEffect, useRef, useState } from "react";
import {
  Search as SearchIcon,
  Plane,
  MapPin,
  X,
  Clock,
  Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { usePreferences, useTracker } from "@/lib/client/store";
import { apiFetch } from "@/lib/client/query";
import type { AircraftState, Coordinate } from "@/lib/aviation/model";
import { mapHandle } from "@/lib/map/handle";
export interface SearchResult {
  id: string;
  label: string;
  detail: string;
  category: "Aircraft" | "Airports" | "Airlines";
  coordinate?: Coordinate;
  aircraft?: AircraftState;
  href?: string;
}
export function Search() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const aircraft = useTracker((state) => state.aircraft);
  const recent = usePreferences((state) => state.recentSearches);
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(text.trim());
      setIndex(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [text]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    const click = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("pointerdown", click);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("pointerdown", click);
    };
  }, []);
  const remote = useQuery({
    queryKey: ["search", query],
    queryFn: ({ signal }) =>
      apiFetch<{ results: SearchResult[]; warnings?: string[] }>(
        `/api/search?q=${encodeURIComponent(query)}`,
        signal,
      ),
    enabled: open && query.length >= 2,
    staleTime: 30000,
  });
  const local: SearchResult[] =
    query.length < 2
      ? []
      : Object.values(aircraft)
          .filter((item) =>
            [
              item.id,
              item.callsign?.value,
              item.registration?.value,
              item.aircraftType?.value,
            ].some((value) =>
              value?.toLowerCase().includes(query.toLowerCase()),
            ),
          )
          .slice(0, 8)
          .map((item) => ({
            id: item.id,
            label: item.callsign?.value || item.registration?.value || item.id,
            detail: `${item.registration?.value || item.id} / ${item.aircraftType?.value || "Type unknown"}`,
            category: "Aircraft",
            aircraft: item,
            coordinate: item.position?.value,
          }));
  const results = [
    ...local,
    ...(remote.data?.results ?? []).filter(
      (result) => !local.some((item) => item.id === result.id),
    ),
  ];
  function choose(result: SearchResult) {
    usePreferences.getState().remember(text);
    setOpen(false);
    if (result.aircraft) {
      useTracker.getState().merge([result.aircraft]);
      useTracker.getState().select(result.aircraft.id);
      if (result.coordinate)
        mapHandle.current?.flyTo({
          center: result.coordinate,
          zoom: 8,
          essential: false,
        });
    } else if (result.href) router.push(result.href);
  }
  return (
    <div ref={wrapper} className="search-container">
      <div className={`search-box surface ${open ? "focused" : ""}`}>
        <SearchIcon size={19} />
        <input
          ref={input}
          aria-label="Search flights, aircraft or airports"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            results[index] ? `search-result-${index}` : undefined
          }
          placeholder="Flight, aircraft, airport..."
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((index + 1) % Math.max(1, results.length));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex(
                (index + results.length - 1) % Math.max(1, results.length),
              );
            }
            if (event.key === "Enter" && results[index]) choose(results[index]);
          }}
        />
        {text ? (
          <button
            aria-label="Clear search"
            className="plain-icon"
            onClick={() => setText("")}
          >
            <X size={16} />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </div>
      {open && (
        <div
          className="search-results surface"
          id="search-results"
          role="listbox"
          aria-label="Search results"
        >
          {!query && (
            <>
              <div className="result-category">Recent searches</div>
              {recent.length ? (
                recent.map((value) => (
                  <button
                    key={value}
                    className="search-result"
                    onClick={() => setText(value)}
                  >
                    <Clock size={16} />
                    <span>{value}</span>
                  </button>
                ))
              ) : (
                <p className="empty-inline">No recent searches.</p>
              )}
            </>
          )}
          {results.map((result, resultIndex) => (
            <div key={`${result.category}:${result.id}`}>
              {resultIndex === 0 ||
              results[resultIndex - 1].category !== result.category ? (
                <div className="result-category">{result.category}</div>
              ) : null}
              <button
                id={`search-result-${resultIndex}`}
                role="option"
                aria-selected={index === resultIndex}
                className={`search-result ${index === resultIndex ? "highlighted" : ""}`}
                onClick={() => choose(result)}
              >
                {result.category === "Aircraft" ? (
                  <Plane size={17} />
                ) : result.category === "Airports" ? (
                  <MapPin size={17} />
                ) : (
                  <Building2 size={17} />
                )}
                <span>
                  <strong>{result.label}</strong>
                  <small>{result.detail}</small>
                </span>
              </button>
            </div>
          ))}
          {query && remote.isFetching && (
            <div className="search-loading">Searching providers...</div>
          )}
          {query.length >= 2 && !remote.isFetching && !results.length && (
            <p className="empty-inline">
              {remote.error
                ? "Search provider unavailable. Local matches remain available."
                : "No matching observations or reference records."}
            </p>
          )}
          {remote.data?.warnings?.map((warning) => (
            <p className="inline-note search-warning" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
