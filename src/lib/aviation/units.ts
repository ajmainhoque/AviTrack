import type { Altitude } from "./model";
export type UnitSystem = "aviation" | "metric" | "us";
export type Quantity =
  | "altitude"
  | "speed"
  | "distance"
  | "verticalRate"
  | "pressure"
  | "temperature";
export function convert(
  value: number,
  quantity: Quantity,
  units: UnitSystem,
): number {
  if (units === "metric") {
    return (
      value *
      {
        altitude: 0.3048,
        speed: 1.852,
        distance: 1.852,
        verticalRate: 0.00508,
        pressure: 1,
        temperature: 1,
      }[quantity]
    );
  }
  if (units === "us") {
    if (quantity === "temperature") return (value * 9) / 5 + 32;
    return (
      value *
      {
        altitude: 1,
        speed: 1.150779448,
        distance: 1.150779448,
        verticalRate: 1,
        pressure: 0.029529983,
        temperature: 1,
      }[quantity]
    );
  }
  return value;
}
export function unitLabel(quantity: Quantity, units: UnitSystem) {
  return {
    aviation: {
      altitude: "ft",
      speed: "kt",
      distance: "NM",
      verticalRate: "ft/min",
      pressure: "hPa",
      temperature: "C",
    },
    metric: {
      altitude: "m",
      speed: "km/h",
      distance: "km",
      verticalRate: "m/s",
      pressure: "hPa",
      temperature: "C",
    },
    us: {
      altitude: "ft",
      speed: "mph",
      distance: "mi",
      verticalRate: "ft/min",
      pressure: "inHg",
      temperature: "F",
    },
  }[units][quantity];
}
export function formatQuantity(
  value: number | null | undefined,
  quantity: Quantity,
  units: UnitSystem = "aviation",
) {
  if (value == null || !Number.isFinite(value)) return "Not available";
  const decimals =
    quantity === "distance" ||
    (quantity === "verticalRate" && units === "metric")
      ? 1
      : quantity === "pressure" && units === "us"
        ? 2
        : 0;
  return `${convert(value, quantity, units).toLocaleString("en-GB", { maximumFractionDigits: decimals })} ${unitLabel(quantity, units)}`;
}
export const formatAltitude = (
  value: Altitude | null | undefined,
  units: UnitSystem = "aviation",
) =>
  value === "ground" ? "On ground" : formatQuantity(value, "altitude", units);
export function formatTime(timestamp: number, zone = "UTC", seconds = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone === "local" ? undefined : zone,
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    timeZoneName: "short",
    hourCycle: "h23",
  }).format(timestamp);
}
