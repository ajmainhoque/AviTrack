import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  output: "standalone",
  outputFileTracingIncludes: {
    "/airport/*": ["./data/ourairports.json"],
    "/api/airports": ["./data/ourairports.json"],
    "/api/search": ["./data/ourairports.json"],
    "/api/map-reference": ["./data/ourairports.json"],
  },
  async headers() {
    const origins = (
      process.env.MAP_ASSET_ORIGINS || "https://tiles.openfreemap.org"
    )
      .split(",")
      .map((origin) => new URL(origin.trim()).origin)
      .join(" ");
    const development = process.env.NODE_ENV === "development";
    const policy = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: ${origins}`,
      `font-src 'self' data:`,
      `connect-src 'self' ${origins}${development ? " ws: wss:" : ""}`,
      `worker-src 'self' blob:`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `frame-ancestors 'none'`,
      `form-action 'self'`,
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: policy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
