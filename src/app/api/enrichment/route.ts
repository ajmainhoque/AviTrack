import { adsbdb } from "@/lib/providers/enrichment";
import { apiError, guard, identifierSchema } from "@/lib/server/api";
export async function GET(request: Request) {
  try {
    guard(request);
    const query = new URL(request.url).searchParams;
    const id = identifierSchema.parse(query.get("id"));
    const kind = query.get("kind");
    const data =
      kind === "route"
        ? await adsbdb.resolveCallsign(id)
        : kind === "airline"
          ? await adsbdb.getAirline(id)
          : await adsbdb.getAircraft(id);
    return Response.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
