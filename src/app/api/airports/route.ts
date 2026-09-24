import { z } from "zod";
import {
  getAirportDetail,
  nearbyAirports,
  searchAirports,
} from "@/lib/server/airports";
import { apiError, guard, identifierSchema } from "@/lib/server/api";
export async function GET(request: Request) {
  try {
    guard(request);
    const query = new URL(request.url).searchParams;
    if (query.has("code")) {
      const detail = await getAirportDetail(
        identifierSchema.parse(query.get("code")),
      );
      return detail
        ? Response.json(detail)
        : Response.json({ error: "Airport not found" }, { status: 404 });
    }
    if (query.has("lat")) {
      const params = z
        .object({
          lat: z.coerce.number().min(-90).max(90),
          lon: z.coerce.number().min(-180).max(180),
          radius: z.coerce.number().min(1).max(250).default(100),
        })
        .parse(Object.fromEntries(query));
      return Response.json(
        await nearbyAirports([params.lon, params.lat], params.radius),
      );
    }
    return Response.json({
      airports: await searchAirports(
        z.string().min(2).max(80).parse(query.get("q")),
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
