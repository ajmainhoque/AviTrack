import { normalizeReadsb } from "../../src/lib/providers/live/readsb";
export function liveFixture(sequence = 0) {
  const now = Date.now();
  return normalizeReadsb(
    {
      now,
      ac: [
        {
          hex: "abc123",
          flight: "TEST123 ",
          r: "ZZ-TEST",
          t: "A320",
          type: "adsb_icao",
          lat: 51.5,
          lon: -0.2 + sequence * 0.0001,
          alt_baro: 30000 + sequence * 25,
          alt_geom: 31200,
          gs: 420,
          track: 270,
          baro_rate: 0,
          squawk: "1234",
          nic: 8,
          nac_p: 9,
          nav_modes: ["autopilot", "lnav"],
          seen: 0,
          seen_pos: 0,
        },
        {
          hex: "~abc124",
          r: "ZZ-GND",
          type: "mlat",
          lat: 51.4706,
          lon: -0.46194,
          alt_baro: "ground",
          gs: 5,
          track: 90,
          seen: 1,
          seen_pos: 2,
          mlat: ["lat", "lon"],
        },
      ],
    },
    "CI test fixture",
    now,
    5000,
  );
}
