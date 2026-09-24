import { z } from "zod";
import { dataValue, type AirportReference } from "../aviation/model";
import { providerRequest, ProviderError, responseReceivedAt } from "./http";
import type { AircraftMetadataProvider, RouteProvider } from "./contracts";
export const airlineSchema = z.object({
  name: z.string(),
  icao: z.string(),
  iata: z.string().nullable(),
  country: z.string(),
  callsign: z.string().nullable(),
});
const airportSchema = z.object({
  icao_code: z.string(),
  iata_code: z.string().nullish(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  municipality: z.string().nullish(),
  country_name: z.string().nullish(),
});
const routeSchema = z.object({
  callsign: z.string(),
  callsign_icao: z.string().nullish(),
  callsign_iata: z.string().nullish(),
  airline: airlineSchema.nullish(),
  origin: airportSchema,
  destination: airportSchema,
  midpoint: airportSchema.nullish(),
});
const metadataSchema = z.object({
  registration: z.string(),
  mode_s: z.string(),
  manufacturer: z.string(),
  type: z.string(),
  icao_type: z.string(),
  registered_owner: z.string(),
  registered_owner_country_name: z.string(),
});
export function mapAirport(
  airport: z.infer<typeof airportSchema>,
): AirportReference {
  return {
    ident: airport.icao_code,
    iata: airport.iata_code || null,
    name: airport.name,
    coordinate: [airport.longitude, airport.latitude],
    municipality: airport.municipality ?? null,
    country: airport.country_name ?? null,
  };
}
async function nullable<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ProviderError && [400, 404].includes(error.status))
      return null;
    throw error;
  }
}
export const adsbdb: AircraftMetadataProvider & RouteProvider = {
  getAircraft: (identifier) =>
    nullable(async () => {
      const response = await providerRequest(
        "adsbdb",
        `/aircraft/${encodeURIComponent(identifier)}`,
        z.object({ response: z.object({ aircraft: metadataSchema }) }),
        3 * 86400000,
      );
      const aircraft = response.response.aircraft;
      return dataValue(
        {
          registration: aircraft.registration,
          hex: aircraft.mode_s,
          manufacturer: aircraft.manufacturer,
          model: aircraft.type,
          type: aircraft.icao_type,
          owner: aircraft.registered_owner,
          country: aircraft.registered_owner_country_name,
        },
        "ADSBDB / Planebase",
        null,
        responseReceivedAt(response),
        "enriched",
      );
    }),
  resolveCallsign: (callsign) =>
    nullable(async () => {
      const response = await providerRequest(
        "adsbdb",
        `/callsign/${encodeURIComponent(callsign.trim())}`,
        z.object({ response: z.object({ flightroute: routeSchema }) }),
        15 * 60000,
      );
      const route = response.response.flightroute;
      return dataValue(
        {
          callsign: route.callsign,
          callsignIcao: route.callsign_icao ?? null,
          callsignIata: route.callsign_iata ?? null,
          airline: route.airline ?? null,
          origin: mapAirport(route.origin),
          destination: mapAirport(route.destination),
          midpoint: route.midpoint ? mapAirport(route.midpoint) : null,
        },
        "ADSBDB / David J Taylor & Jim Mason",
        null,
        responseReceivedAt(response),
        "enriched",
      );
    }),
  getAirline: (code) =>
    nullable(async () => {
      const response = await providerRequest(
        "adsbdb",
        `/airline/${encodeURIComponent(code)}`,
        z.object({ response: z.array(airlineSchema) }),
        86400000,
      );
      return dataValue(
        response.response,
        "ADSBDB",
        null,
        responseReceivedAt(response),
        "enriched",
      );
    }),
};
