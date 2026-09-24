import { z } from "zod";
import { normalizeReadsb, readsbAircraftSchema } from "./readsb";
const frameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("full"),
    seq: z.number().int().nonnegative(),
    now: z.number().optional(),
    ac: z.array(readsbAircraftSchema),
  }),
  z.object({
    type: z.literal("delta"),
    seq: z.number().int().nonnegative(),
    now: z.number().optional(),
    new: z.array(readsbAircraftSchema).default([]),
    update: z.array(readsbAircraftSchema).default([]),
    remove: z.array(z.string()).default([]),
  }),
]);
type RawAircraft = z.infer<typeof readsbAircraftSchema>;
interface Stored {
  raw: RawAircraft;
  positionAt: number | null;
  messageAt: number | null;
}
export class AircraftDeltaStore {
  private aircraft = new Map<string, Stored>();
  private sequence: number | null = null;
  reset() {
    this.aircraft.clear();
    this.sequence = null;
  }
  apply(input: unknown, receivedAt = Date.now()) {
    const frame = frameSchema.parse(input);
    if (
      frame.type === "delta" &&
      (this.sequence === null || frame.seq !== this.sequence + 1)
    ) {
      this.reset();
      throw new Error("Stream sequence gap; full snapshot required");
    }
    if (frame.type === "full") this.aircraft.clear();
    const time =
      frame.now == null
        ? receivedAt
        : frame.now > 1e12
          ? frame.now
          : frame.now * 1000;
    const updates =
      frame.type === "full" ? frame.ac : [...frame.new, ...frame.update];
    for (const update of updates) {
      const id = update.hex.toLowerCase();
      const previous = this.aircraft.get(id);
      if (
        frame.type === "delta" &&
        frame.update.includes(update) &&
        !previous
      ) {
        this.reset();
        throw new Error("Unknown aircraft patch; full snapshot required");
      }
      const clean = Object.fromEntries(
        Object.entries(update).filter(([, value]) => value !== undefined),
      );
      const raw = readsbAircraftSchema.parse({ ...previous?.raw, ...clean });
      this.aircraft.set(id, {
        raw,
        positionAt:
          update.seen_pos != null
            ? time - update.seen_pos * 1000
            : (previous?.positionAt ?? null),
        messageAt:
          update.seen != null
            ? time - update.seen * 1000
            : (previous?.messageAt ?? null),
      });
    }
    if (frame.type === "delta")
      for (const id of frame.remove) this.aircraft.delete(id.toLowerCase());
    this.sequence = frame.seq;
    return this.snapshot(receivedAt);
  }
  snapshot(receivedAt = Date.now(), refreshMs = 10000) {
    return normalizeReadsb(
      {
        now: receivedAt / 1000,
        ac: [...this.aircraft.values()].map((entry) => ({
          ...entry.raw,
          seen:
            entry.messageAt == null
              ? null
              : (receivedAt - entry.messageAt) / 1000,
          seen_pos:
            entry.positionAt == null
              ? null
              : (receivedAt - entry.positionAt) / 1000,
        })),
      },
      "ADSBiq",
      receivedAt,
      refreshMs,
    );
  }
}
