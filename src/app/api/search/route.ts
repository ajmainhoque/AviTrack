import { z } from "zod";
import { withLiveProvider } from "@/lib/providers/live";
import { adsbdb } from "@/lib/providers/enrichment";
import { apiError, guard } from "@/lib/server/api";
import type { SearchResult } from "@/components/map/search";
import { searchAirports } from "@/lib/server/airports";
import { classifyIdentity } from "@/lib/search/classify";
export async function GET(request: Request) {
  try {
    guard(request);
    const query = z
      .string()
      .trim()
      .min(2)
      .max(80)
      .parse(new URL(request.url).searchParams.get("q"));
    const id = query.toUpperCase();
    const results: SearchResult[] = [];
    const warnings: string[] = [];
    try {
      const airports = await searchAirports(query, 8);
      for (const airport of airports)
        results.push({
          id: airport.ident,
          category: "Airports",
          label: `${airport.iata_code || airport.ident} / ${airport.name}`,
          detail: [airport.municipality, airport.iso_country, airport.ident]
            .filter(Boolean)
            .join(" / "),
          coordinate: [airport.longitude_deg, airport.latitude_deg],
          href: `/airport/${airport.ident}`,
        });
    } catch {
      warnings.push("Airport reference data unavailable.");
    }
    const identityKind = classifyIdentity(id);
    if (identityKind) {
      try {
        let callsign = id;
        if (/^[A-Z]{2}\d{1,4}[A-Z]?$/.test(id)) {
          try {
            const route = await adsbdb.resolveCallsign(id);
            callsign = route?.value.callsignIcao || id;
            if (callsign === id) {
              const airlines = await adsbdb.getAirline(id.slice(0, 2));
              if (airlines?.value.length === 1)
                callsign = `${airlines.value[0].icao}${id.slice(2)}`;
            }
          } catch {
            warnings.push(
              "Flight-number enrichment unavailable; trying the original identifier.",
            );
          }
          if (callsign !== id)
            warnings.push(
              `${id} matched to ${callsign} by public route lookup; flight numbers and callsigns can differ.`,
            );
        }
        const snapshot = await withLiveProvider((provider) =>
          identityKind === "hex"
            ? provider.getAircraftByHex(id)
            : identityKind === "registration"
              ? provider.getAircraftByRegistration(id)
              : identityKind === "type"
                ? provider.getAircraftByType(id)
                : provider.getAircraftByCallsign(callsign),
        );
        for (const aircraft of snapshot.aircraft.slice(0, 15))
          results.push({
            id: aircraft.id,
            category: "Aircraft",
            label:
              aircraft.callsign?.value ||
              aircraft.registration?.value ||
              aircraft.id.toUpperCase(),
            detail: `${aircraft.registration?.value || aircraft.id} / ${aircraft.source}`,
            coordinate: aircraft.position?.value,
            aircraft,
          });
      } catch {
        warnings.push(
          "Live identity lookup unavailable; local map matches may still be available.",
        );
      }
    }
    if (/^[A-Z]{2,3}$/.test(id)) {
      try {
        const airlines = await adsbdb.getAirline(id);
        for (const airline of airlines?.value ?? [])
          results.push({
            id: airline.icao,
            category: "Airlines",
            label: airline.name,
            detail: `${airline.iata || "No IATA"} / ${airline.icao} / ${airline.country}`,
            href: `/airline/${airline.icao}`,
          });
      } catch {
        warnings.push("Airline lookup unavailable.");
      }
    }
    return Response.json({ results, warnings });
  } catch (error) {
    return apiError(error);
  }
}
