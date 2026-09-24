import { spawn } from "node:child_process";
import { copyFile, mkdir, unlink } from "node:fs/promises";
await mkdir("data", { recursive: true });
await copyFile("tests/fixtures/reference.json", "data/e2e-reference.json");
const server = spawn(process.execPath, ["scripts/start.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: "3100",
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    DATABASE_URL: "",
    LIVE_PROVIDER: "adsblol",
    FALLBACK_LIVE_PROVIDER: "none",
    SCHEDULE_PROVIDER: "none",
    GLOBAL_LIVE_MODE: "false",
    ADSBIQ_STREAM_ENABLED: "false",
    REFERENCE_DATA_FILE: "e2e-reference.json",
    LOG_LEVEL: "silent",
  },
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.kill());
server.on("exit", async (code) => {
  await unlink("data/e2e-reference.json").catch(() => undefined);
  process.exit(code ?? 0);
});
