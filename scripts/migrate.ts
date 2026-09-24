import nextEnv from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required for migrations.");
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Database migrations complete.");
} finally {
  await client.end();
}
