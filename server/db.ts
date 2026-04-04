import { drizzle } from "drizzle-orm/node-postgres";
import * as pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "[DB] DATABASE_URL not set — database features will be unavailable. Set DATABASE_URL to enable persistence.",
  );
}

// pool will only be valid when DATABASE_URL is defined; modules that import
// db directly must guard against connection errors at runtime.
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  : (null as unknown as InstanceType<typeof Pool>);

export const db = process.env.DATABASE_URL
  ? drizzle(pool, { schema })
  : (null as unknown as ReturnType<typeof drizzle>);
