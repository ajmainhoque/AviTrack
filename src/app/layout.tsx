import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/400.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { QueryProvider } from "@/lib/client/query";
import { Connectivity } from "@/components/common/connectivity";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AviTrack | Live Airspace", template: "%s | AviTrack" },
  description:
    "Independent live aviation observations, aircraft trajectories, airports and weather. Open data, visible provenance.",
  applicationName: "AviTrack",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <Connectivity />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
