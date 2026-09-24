import { cp, access, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
await access(".next/standalone/server.js").catch(() => {
  throw new Error("Production build missing. Run npm run build first.");
});
await cp("public", ".next/standalone/public", { recursive: true });
await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
try {
  await access("data");
  await cp("data", ".next/standalone/data", { recursive: true });
} catch {}
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: { ...process.env, HOSTNAME: process.env.HOSTNAME || "0.0.0.0" },
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.kill());
server.on("exit", (code) => process.exit(code ?? 0));
