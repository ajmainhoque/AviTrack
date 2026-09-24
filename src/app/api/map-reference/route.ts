import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { featureCollection, lineString, point } from "@turf/turf";
import { getDatabase } from "@/lib/db";
import * as tables from "@/lib/db/schema";
import { apiError, guard } from "@/lib/server/api";
import { localReference, nearbyAirports } from "@/lib/server/airports";
import { distanceNm } from "@/lib/aviation/calculations";
import type { Runway, Navaid } from "@/lib/aviation/reference";
export async function GET(request: Request) {
  try {
    guard(request);
    const query = new URL(request.url).searchParams;
    const database = getDatabase();
    if (query.get("overview") === "true") {
      const airports = database
        ? (
            await database
              .select({ data: tables.airports.data })
              .from(tables.airports)
              .where(eq(tables.airports.type, "large_airport"))
          ).map((row) => row.data)
        : (await localReference()).airports.filter(
            (airport) => airport.type === "large_airport",
          );
      return Response.json({
        airports: featureCollection(
          airports.map((airport) =>
            point([airport.longitude_deg, airport.latitude_deg], {
              ident: airport.ident,
              label: airport.iata_code || airport.ident,
              name: airport.name,
              source: "OurAirports",
            }),
          ),
        ),
        runways: featureCollection([]),
        navaids: featureCollection([]),
      });
    }
    const params = z
      .object({
        lat: z.coerce.number().min(-90).max(90),
        lon: z.coerce.number().min(-180).max(180),
        radius: z.coerce.number().min(1).max(250).default(100),
      })
      .parse(Object.fromEntries(query));
    const reference = await nearbyAirports(
      [params.lon, params.lat],
      params.radius,
    );
    const ids = new Set(reference.airports.map((airport) => airport.ident));
    let runways: Runway[];
    let navaids: Navaid[];
    if (database && ids.size) {
      runways = (
        await database
          .select({ data: tables.runways.data })
          .from(tables.runways)
          .where(inArray(tables.runways.airportIdent, [...ids]))
      ).map((row) => row.data);
      navaids = (
        await database
          .select({ data: tables.navaids.data })
          .from(tables.navaids)
          .where(inArray(tables.navaids.airportIdent, [...ids]))
      ).map((row) => row.data);
    } else {
      const local = await localReference();
      runways = local.runways.filter((runway) => ids.has(runway.airport_ident));
      navaids = local.navaids.filter(
        (navaid) =>
          navaid.longitude_deg != null &&
          navaid.latitude_deg != null &&
          distanceNm(
            [params.lon, params.lat],
            [navaid.longitude_deg, navaid.latitude_deg],
          ) < params.radius,
      );
    }
    return Response.json(
      {
        source: "OurAirports",
        syncedAt: reference.syncedAt,
        airports: featureCollection(
          reference.airports.map((airport) =>
            point([airport.longitude_deg, airport.latitude_deg], {
              ident: airport.ident,
              label: airport.iata_code || airport.ident,
              name: airport.name,
              source: "OurAirports",
            }),
          ),
        ),
        runways: featureCollection(
          runways.flatMap((runway) =>
            runway.le_longitude_deg != null &&
            runway.le_latitude_deg != null &&
            runway.he_longitude_deg != null &&
            runway.he_latitude_deg != null
              ? [
                  lineString(
                    [
                      [runway.le_longitude_deg, runway.le_latitude_deg],
                      [runway.he_longitude_deg, runway.he_latitude_deg],
                    ],
                    {
                      ident: runway.airport_ident,
                      label: `${runway.le_ident || "?"}/${runway.he_ident || "?"}`,
                      source: "OurAirports",
                    },
                  ),
                ]
              : [],
          ),
        ),
        navaids: featureCollection(
          navaids.flatMap((navaid) =>
            navaid.longitude_deg != null && navaid.latitude_deg != null
              ? [
                  point([navaid.longitude_deg, navaid.latitude_deg], {
                    label: `${navaid.ident} ${navaid.type}`,
                    name: navaid.name,
                    source: "OurAirports",
                  }),
                ]
              : [],
          ),
        ),
      },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
