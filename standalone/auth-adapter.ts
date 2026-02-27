import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function createSessionStore() {
  const PgStore = connectPg(session);
  return new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: SESSION_TTL,
    tableName: "sessions",
  });
}

export async function setupAuth(app: Express): Promise<void> {
  const sessionMiddleware = session({
    store: createSessionStore(),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: SESSION_TTL,
      sameSite: "lax" as const,
    },
  });

  app.use(sessionMiddleware);

  app.post("/api/login", (req: any, res) => {
    const { username, code } = req.body || {};
    if (!username || !code) {
      return res.status(400).json({ message: "Username and access code required" });
    }

    const ADMIN_CODE = process.env.ADMIN_ACCESS_CODE || "71580019";
    const USER_CODE = process.env.USER_ACCESS_CODE || "170392";
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "DELTA UNIFORM 00";

    let role = "user";
    if (username === ADMIN_USERNAME && code === ADMIN_CODE) {
      role = "admin";
    } else if (code !== USER_CODE) {
      return res.status(401).json({ message: "Invalid access code" });
    }

    const userId = crypto.createHash("sha256").update(username).digest("hex").slice(0, 16);

    req.session.user = {
      id: userId,
      username,
      role,
      claims: { sub: userId },
    };

    req.session.save((err: any) => {
      if (err) {
        console.error("[Auth] Session save error:", err);
        return res.status(500).json({ message: "Session error" });
      }
      res.json({ success: true, user: { id: userId, username, role } });
    });
  });

  app.post("/api/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) console.error("[Auth] Session destroy error:", err);
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", (req: any, res) => {
    if (req.session?.user) {
      return res.json(req.session.user);
    }
    res.status(401).json({ message: "Not authenticated" });
  });
}

export const isAuthenticated: RequestHandler = (req: any, res, next) => {
  if (req.session?.user) {
    req.user = req.session.user;
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
};

export function getSession() {
  return session({
    store: createSessionStore(),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: SESSION_TTL,
      sameSite: "lax" as const,
    },
  });
}

export function registerAuthRoutes(_app: Express): void {}
