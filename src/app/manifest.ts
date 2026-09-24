import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AviTrack Live Airspace",
    short_name: "AviTrack",
    description:
      "Live aviation observations, local tracks, airport reference and weather.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8f7",
    theme_color: "#007e78",
    icons: [
      {
        src: "/api/app-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/app-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
