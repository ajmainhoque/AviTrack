import { z } from "zod";
import { subscribeAdsbIq } from "@/lib/providers/live/adsbiq-stream";
import { apiError, guard } from "@/lib/server/api";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    guard(request);
    const query = new URL(request.url).searchParams;
    const zone =
      query.get("global") === "true"
        ? null
        : z
            .object({
              lat: z.coerce.number().min(-90).max(90),
              lon: z.coerce.number().min(-180).max(180),
            })
            .parse(Object.fromEntries(query));
    const encoder = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let active = true;
        const unsubscribe = subscribeAdsbIq(zone, (snapshot) => {
          if (active)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`),
            );
        });
        const keepalive = setInterval(() => {
          if (active) controller.enqueue(encoder.encode(": keepalive\n\n"));
        }, 20000);
        cleanup = () => {
          if (!active) return;
          active = false;
          clearInterval(keepalive);
          unsubscribe();
        };
        request.signal.addEventListener(
          "abort",
          () => {
            cleanup();
            controller.close();
          },
          { once: true },
        );
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
