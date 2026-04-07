import { drizzle } from "drizzle-orm/node-postgres";
import * as pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn(
    "[DB] DATABASE_URL not set — running without persistent database (in-memory fallback active).",
  );
}

// When no DATABASE_URL is set, pool/db are null and storage falls back to
// the in-memory implementation.  External callers that import `db` directly
// should guard with `hasDatabase` or use try/catch.
export const hasDatabase: boolean = !!dbUrl;

export const pool: pg.Pool | null = dbUrl
  ? new Pool({ connectionString: dbUrl })
  : null;

// Cast to the same type as the real db so TypeScript callers are unchanged.
// Operations on the stub will throw at call-time (not import-time), which is
// fine because every direct db caller is already wrapped in try/catch.
export const db: ReturnType<typeof drizzle<typeof schema>> = dbUrl
  ? drizzle(pool!, { schema })
  : (new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
      get(_target, prop) {
        return () => {
          throw new Error(
            `[DB] No database configured (attempted db.${String(prop)}). Set DATABASE_URL to enable persistence.`,
          );
        };
      },
    }));
