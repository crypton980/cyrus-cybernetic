import { drizzle } from "drizzle-orm/node-postgres";
import * as pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

export const hasDatabase = Boolean(process.env.DATABASE_URL);

// When DATABASE_URL is not set we export a deep no-op Proxy so that any code
// that imports `db` at module load time does not throw.  Operations performed
// against this proxy are silently ignored; route handlers should check
// `hasDatabase` before executing database queries.
function makeNoopProxy(): any {
  return new Proxy(Object.create(null), {
    get(_t, prop) {
      if (prop === "then") return undefined; // not a Promise
      return makeNoopProxy();
    },
    apply() { return makeNoopProxy(); },
  });
}

let pool: pg.Pool | null = null;

if (!hasDatabase) {
  console.warn(
    "[DB] DATABASE_URL is not set. Running in memory-only mode — database features are disabled.",
  );
}

export { pool };
export const db: ReturnType<typeof drizzle<typeof schema>> = hasDatabase
  ? (() => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL! });
      return drizzle(pool, { schema });
    })()
  : makeNoopProxy();
