import { z } from "zod";
import { withLiveProvider } from "@/lib/providers/live";
import { apiError, guard, identifierSchema } from "@/lib/server/api";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    guard(request);
    const query = new URL(request.url).searchParams;
    const identifier = query.get("id");
    const result = await withLiveProvider(async (provider) => {
      if (identifier) {
        const id = identifierSchema.parse(identifier);
        const kind = z
          .enum(["hex", "callsign", "registration", "type", "squawk"])
          .parse(query.get("kind") ?? "hex");
        if (kind === "callsign") return provider.getAircraftByCallsign(id);
        if (kind === "registration")
          return provider.getAircraftByRegistration(id);
        if (kind === "type") return provider.getAircraftByType(id);
        if (kind === "squawk") return provider.getAircraftBySquawk(id);
        return provider.getAircraftByHex(id);
      }
      if (query.get("global") === "true" && provider.getGlobalSnapshot)
        return provider.getGlobalSnapshot();
      const bounds = z
        .object({
          lat: z.coerce.number().min(-90).max(90),
          lon: z.coerce.number().min(-180).max(180),
          radius: z.coerce.number().min(1).max(250).default(100),
        })
        .parse(Object.fromEntries(query));
      return provider.getAircraftNear(
        Math.round(bounds.lat * 20) / 20,
        Math.round(bounds.lon * 20) / 20,
        Math.ceil(bounds.radius / 10) * 10,
      );
    });
    return Response.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Refresh-Ms": String(result.refreshMs),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
