// server/src/cors.js  (ESM)
import cors from 'cors';

/**
 * Reads CORS_ORIGINS (comma‑separated) and builds a cors() middleware
 * that accepts the listed origins. If none provided, allows all.
 */
export function buildCors() {
  const allowlist = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const open = allowlist.length === 0;

  const options = {
    origin(origin, cb) {
      // Non-browser clients (curl/Postman) send no Origin → allow
      if (!origin) return cb(null, true);
      if (open || allowlist.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,       // fine with Bearer tokens; required if you ever use cookies
    maxAge: 86400,           // cache preflight for 1 day
  };

  return cors(options);
}