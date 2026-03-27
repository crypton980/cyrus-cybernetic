import { drizzle } from "drizzle-orm/node-postgres";
import * as pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error(
    "⚠️  DATABASE_URL is not set. The server will start but all database " +
    "operations will fail. In Railway, add a PostgreSQL service to " +
    "automatically provide DATABASE_URL."
  );
}

// When DATABASE_URL is missing, pool and db are null. Routes that call the
// database will throw at runtime, but the server and UI will still load.
export const pool: pg.Pool = dbUrl
  ? new Pool({ connectionString: dbUrl })
  : (null as unknown as pg.Pool);

export const db: ReturnType<typeof drizzle<typeof schema>> = dbUrl
  ? drizzle(pool, { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);
