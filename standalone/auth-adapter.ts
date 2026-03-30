import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import crypto from "crypto";

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const CSRF_TOKEN_BYTES = 32;

function resolveSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production.");
  }

  console.warn("[Auth] SESSION_SECRET not set. Using ephemeral session secret for non-production mode.");
  return crypto.randomBytes(32).toString("hex");
}

function resolveAccessConfig() {
  const isProduction = process.env.NODE_ENV === "production";

  const adminCode = process.env.ADMIN_ACCESS_CODE || (isProduction ? "" : "71580019");
  const userCode = process.env.USER_ACCESS_CODE || (isProduction ? "" : "170392");
  const adminUsername = process.env.ADMIN_USERNAME || "DELTA UNIFORM 00";

  if (isProduction && (!adminCode || !userCode)) {
    throw new Error("ADMIN_ACCESS_CODE and USER_ACCESS_CODE must be set in production.");
  }

  return { adminCode, userCode, adminUsername };
}

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
  const sessionSecret = resolveSessionSecret();
  const { adminCode, userCode, adminUsername } = resolveAccessConfig();

  const sessionMiddleware = session({
    store: createSessionStore(),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL,
      sameSite: "strict" as const,
    },
  });

  app.use(sessionMiddleware);

  // ── CSRF token endpoint (synchronizer token pattern) ──────────────────────
  // The frontend must call GET /api/csrf-token before POST /api/login and
  // include the returned token as the X-CSRF-Token request header.
  app.get("/api/csrf-token", (req: any, res) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(CSRF_TOKEN_BYTES).toString("hex");
    }
    res.json({ csrfToken: req.session.csrfToken });
  });

  app.post("/api/login", (req: any, res) => {
    // ── CSRF: synchronizer token validation ───────────────────────────────
    const sessionCsrfToken: string | undefined = req.session.csrfToken;
    const headerCsrfToken: string | undefined =
      req.get("x-csrf-token") || req.get("x-xsrf-token");

    if (!sessionCsrfToken || !headerCsrfToken) {
      return res.status(403).json({ message: "CSRF token missing" });
    }
    // Constant-time comparison to prevent timing attacks
    if (
      sessionCsrfToken.length !== headerCsrfToken.length ||
      !crypto.timingSafeEqual(Buffer.from(sessionCsrfToken), Buffer.from(headerCsrfToken))
    ) {
      return res.status(403).json({ message: "CSRF token invalid" });
    }

    // Additional host-origin check for defense in depth
    const origin = req.get("origin") || req.get("referer");
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        const serverHost = req.get("host") || "";
        if (originHost !== serverHost) {
          return res.status(403).json({ message: "Forbidden: origin mismatch" });
        }
      } catch {
        return res.status(403).json({ message: "Forbidden: invalid origin" });
      }
    }

    const { username, code } = req.body || {};
    if (!username || !code) {
      return res.status(400).json({ message: "Username and access code required" });
    }

    let role = "user";
    if (username === adminUsername && code === adminCode) {
      role = "admin";
    } else if (code !== userCode) {
      return res.status(401).json({ message: "Invalid access code" });
    }

    const userId = crypto.createHash("sha256").update(username).digest("hex").slice(0, 16);

    // Rotate CSRF token after successful authentication
    req.session.csrfToken = crypto.randomBytes(CSRF_TOKEN_BYTES).toString("hex");

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
    // ── CSRF: synchronizer token validation ───────────────────────────────
    const sessionCsrfToken: string | undefined = req.session.csrfToken;
    const headerCsrfToken: string | undefined =
      req.get("x-csrf-token") || req.get("x-xsrf-token");

    if (!sessionCsrfToken || !headerCsrfToken) {
      return res.status(403).json({ message: "CSRF token missing" });
    }
    if (
      sessionCsrfToken.length !== headerCsrfToken.length ||
      !crypto.timingSafeEqual(Buffer.from(sessionCsrfToken), Buffer.from(headerCsrfToken))
    ) {
      return res.status(403).json({ message: "CSRF token invalid" });
    }

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
  const sessionSecret = resolveSessionSecret();

  return session({
    store: createSessionStore(),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL,
      sameSite: "strict" as const,
    },
  });
}

export function registerAuthRoutes(_app: Express): void {}
