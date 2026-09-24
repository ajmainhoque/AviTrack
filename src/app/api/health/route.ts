import { getHealth } from "@/lib/providers/http";
import { config, liveRefreshMs } from "@/lib/config/server";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    {
      providers: getHealth(),
      preferred: config.LIVE_PROVIDER,
      fallback: config.FALLBACK_LIVE_PROVIDER,
      refreshMs: liveRefreshMs(),
      database: Boolean(config.DATABASE_URL),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
