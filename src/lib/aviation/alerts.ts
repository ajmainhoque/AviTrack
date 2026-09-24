import type { AircraftState } from "./model";
import { emergency, freshness } from "./calculations";
export function observationAlerts(previous: AircraftState | undefined, current: AircraftState, now: number): string[] {
  if (freshness(current.position?.observedAt ?? null, now) !== "live") return [];
  const name = current.callsign?.value || current.registration?.value || current.id;
  const messages: string[] = [];
  if (!previous || freshness(previous.position?.observedAt ?? null, now) === "lost") messages.push(`${name}: observed in current coverage`);
  if (previous?.squawk && current.squawk && previous.squawk.value !== current.squawk.value) messages.push(`${name}: squawk changed from ${previous.squawk.value} to ${current.squawk.value}`);
  const explicit = typeof current.fields.emergency?.value === "string" ? current.fields.emergency.value : null;
  const currentEmergency = emergency(current.squawk?.value ?? null, explicit);
  const previousEmergency = previous ? emergency(previous.squawk?.value ?? null, typeof previous.fields.emergency?.value === "string" ? previous.fields.emergency.value : null) : null;
  if (currentEmergency && currentEmergency !== previousEmergency) messages.push(`${name}: ${currentEmergency}`);
  if (previous?.altBaro?.value === "ground" && typeof current.altBaro?.value === "number" && (current.groundSpeed?.value ?? 0) > 60) messages.push(`${name}: airborne transition observed (inferred takeoff)`);
  if (typeof previous?.altBaro?.value === "number" && current.altBaro?.value === "ground") messages.push(`${name}: ground transition observed (inferred landing)`);
  return messages;
}