import { z } from "zod";
import { config } from "@/lib/config/server";
import { airportBoard, scheduleProvider } from "@/lib/providers/schedule";
import { apiError, guard, identifierSchema } from "@/lib/server/api";
export async function GET(request: Request) {
  try {
    guard(request);
    const query = new URL(request.url).searchParams;
    if (config.SCHEDULE_PROVIDER === "none")
      return Response.json({ configured: false, data: null });
    const explicit = query.get("explicit") === "true";
    const data = query.has("airport")
      ? await airportBoard(
          z
            .string()
            .regex(/^[A-Z0-9]{3,4}$/)
            .parse(query.get("airport")),
          z.enum(["arrival", "departure"]).parse(query.get("direction")),
          explicit,
        )
      : await scheduleProvider.getFlight(
          identifierSchema.parse(query.get("flight")).toUpperCase(),
          explicit,
        );
    return Response.json({ configured: true, data });
  } catch (error) {
    return apiError(error);
  }
}
