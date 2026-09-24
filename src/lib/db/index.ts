import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;
export function getDatabase() {
  if (!process.env.DATABASE_URL) return null;
  if (!database)
    database = drizzle(
      postgres(process.env.DATABASE_URL, {
        max: 3,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
      }),
      { schema },
    );
  return database;
}
