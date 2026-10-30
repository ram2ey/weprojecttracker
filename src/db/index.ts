import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { databaseUrl } from "../lib/database-url";
const globalDb = globalThis as unknown as { wassaPool?: Pool };
export function getPool() {
  return (globalDb.wassaPool ??= new Pool({
    connectionString: databaseUrl(),
    max: 8,
    connectionTimeoutMillis: 5000,
  }));
}
export function getDb() {
  return drizzle(getPool(), { schema });
}
