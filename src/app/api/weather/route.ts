import { z } from "zod";
import { config } from "@/lib/config/server";
import { apiError, guard } from "@/lib/server/api";
import {
  bulkMetars,
  stationWeather,
  weatherOverlay,
} from "@/lib/providers/weather";
export async function GET(request: Request) {
  try {
    guard(request);
    const query = new URL(request.url).searchParams;
    if (query.has("station"))
      return Response.json(
        await stationWeather(
          z
            .string()
            .toUpperCase()
            .regex(/^[A-Z0-9]{4}$/)
            .parse(query.get("station")),
        ),
      );
    if (!config.WEATHER_OVERLAY) return Response.json({ error: "Weather overlays are disabled" }, { status: 403 });
    const product = z
      .enum(["metar", "sigmet", "isigmet", "gairmet", "pirep"])
      .parse(query.get("product"));
    if (product === "metar") return Response.json(await bulkMetars());
    const bounds = query.has("bbox")
      ? z
          .tuple([
            z.number().min(-90).max(90),
            z.number().min(-180).max(180),
            z.number().min(-90).max(90),
            z.number().min(-180).max(180),
          ])
          .parse(query.get("bbox")!.split(",").map(Number))
      : undefined;
    if (product === "pirep" && !bounds)
      return Response.json(
        { error: "PIREP queries require a bounding box" },
        { status: 400 },
      );
    return Response.json(await weatherOverlay(product, bounds));
  } catch (error) {
    return apiError(error);
  }
}
