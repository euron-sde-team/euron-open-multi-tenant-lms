import express, { Express, NextFunction, Request, Response } from "express";

import helmet from "helmet";
import { notFound } from "./controllers/health.controller";
import { globalHandler } from "./middlewares/error-handler.middleware";
import { tenantResolverMiddleware } from "./middlewares/tenant-resolver.middleware";
import { tenantStatusGuard } from "./middlewares/tenant-status-guard.middleware";
import { sanitizeInput } from "./middlewares/sanitize.middleware";
import internalRouter from "./routes/internal.route";
import rootRouter from "./routes/index.route";
import webhookRouter from "./routes/webhook.route";
import { asyncHandler } from "./utils/asynchandler";
import logger from "./utils/logger";
import { getLocalIP } from "./utils/system.util";
import config from "./config";

const app: Express = express();
// Proxy hops in front of the API (1 behind the ALB); never "true", which
// would let any client spoof X-Forwarded-For for rate limiting and audit IPs.
app.set("trust proxy", config.TRUST_PROXY);

// CORS must be the very first middleware so preflight OPTIONS are handled before anything else
const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Storefronts live on every tenant subdomain and on custom domains, so the
  // origin set is open-ended. Auth is a bearer token in a header, never a
  // cookie, so "*" without Allow-Credentials lets no other site act as a learner.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Tenant-Host");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, X-Content-Range");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};
app.use(corsMiddleware);

// Webhook routes need raw body for signature verification, mount before json/urlencoded parsers.
// Razorpay and Stripe both post application/json.
app.use("/api/v1/webhooks", express.raw({ type: "application/json" }), webhookRouter);

// Body parser - must come before sanitization middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// navigator.sendBeacon defaults to Content-Type: text/plain;charset=UTF-8.
// Used by the lecture watch tracker on tab unload, payload is a JSON string.
app.use(express.text({ type: "text/plain", limit: "4kb" }));

// Helmet for security headers (after CORS so preflight is handled first)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "deny" },
    xssFilter: true,
  })
);

// 3. XSS Sanitization middleware (express-xss-sanitizer)
// Sanitizes req.body, req.query, req.params, and req.headers to prevent XSS attacks
// Express 5 compatible and actively maintained
// Note: For additional input validation, use express-validator in your route handlers
app.use(sanitizeInput);

// Internal server-to-server routes (e.g. tenant-admin → learner-api). Mounted
// before tenant resolution since there is no tenant hostname on these calls;
// authenticated by a shared internal key instead.
app.use("/api/v1/internal", internalRouter);

// 4. Tenant resolution from hostname (for frontend rendering)
app.use(tenantResolverMiddleware);

// 5. Tenant status enforcement (after resolver, before routes)
app.use(tenantStatusGuard);

// API routes (tenant resolved from req Host header)
app.use("/api", rootRouter);

// Catch-all route for 404 - API-only server, no proxying. Frontend is served separately (e.g. Next.js on 3000).
app.use(asyncHandler(notFound));

app.use((
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any, req: Request, res: Response, next: NextFunction
) => {
  globalHandler(data, req, res, next);
});

logger.info(`Local IP - ${getLocalIP()}`);

export default app;
