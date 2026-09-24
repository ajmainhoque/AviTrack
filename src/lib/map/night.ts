import * as SunCalc from "suncalc";
import { featureCollection, polygon } from "@turf/turf";
export function nightOverlay(timestamp: number) {
  const date = new Date(timestamp);
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (let longitude = -180; longitude < 180; longitude += 3) {
    for (const twilight of [0, -6]) {
      const threshold = (twilight * Math.PI) / 180;
      const isDark = (latitude: number) =>
        SunCalc.getPosition(date, latitude, longitude + 1.5).altitude <
        threshold;
      let previousDark = isDark(-85);
      let start: number | null = previousDark ? -85 : null;
      const intervals: [number, number][] = [];
      for (let latitude = -80; latitude <= 85; latitude += 5) {
        const dark = isDark(latitude);
        if (dark !== previousDark) {
          let lower = latitude - 5;
          let upper = latitude;
          for (let iteration = 0; iteration < 15; iteration++) {
            const middle = (lower + upper) / 2;
            if (isDark(middle) === previousDark) lower = middle;
            else upper = middle;
          }
          const boundary = (lower + upper) / 2;
          if (dark) start = boundary;
          else if (start !== null) {
            intervals.push([start, boundary]);
            start = null;
          }
        }
        previousDark = dark;
      }
      if (start !== null) intervals.push([start, 85]);
      for (const [south, north] of intervals)
        features.push(
          polygon(
            [
              [
                [longitude, south],
                [longitude, north],
                [longitude + 3, north],
                [longitude + 3, south],
                [longitude, south],
              ],
            ],
            {
              twilight,
              source:
                "SunCalc local solar geometry (3-degree longitude strips)",
              kind: "estimated",
              timestamp,
            },
          ),
        );
    }
  }
  return featureCollection(features);
}
