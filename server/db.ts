import { drizzle } from "drizzle-orm/node-postgres";
import * as pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

export const hasDatabase = !!process.env.DATABASE_URL;

let pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

if (hasDatabase) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzle(pool, { schema });
} else {
  console.warn(
    "[db] DATABASE_URL is not set — running without a database. " +
    "All database operations will be silently no-ops. " +
    "Set DATABASE_URL to enable persistent storage.",
  );
}

export { pool };

// A deeply-chainable no-op proxy that also acts as a thenable (Promise).
function makeNoOpChain(): any {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make it a thenable so await db.insert(...).values(...) resolves to []
        return (resolve: (v: any) => void) => resolve([]);
      }
      if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") {
        return () => "[no-db]";
      }
      return makeNoOpChain;
    },
    apply(_target, _thisArg, _args) {
      return makeNoOpChain();
    },
  };
  const fn = function noOpDb() {};
  return new Proxy(fn, handler);
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    if (_db) return (_db as any)[prop];
    // Return a deeply-chainable no-op when no database is configured
    return makeNoOpChain();
  },
});
