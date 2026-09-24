import { ImageResponse } from "next/og";
export function GET(request: Request) {
  const size =
    new URL(request.url).searchParams.get("size") === "512" ? 512 : 192;
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#007e78",
        color: "#ffffff",
        fontSize: size * 0.4,
        fontWeight: 700,
      }}
    >
      AT
    </div>,
    { width: size, height: size },
  );
}
