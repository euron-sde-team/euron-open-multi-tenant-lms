import express, { Express, NextFunction, Request, Response } from "express";

import helmet from "helmet";
import { notFound } from "./controllers/health.controller";
import webhookRouter from "./routes/webhook.route";
import { globalHandler } from "./middlewares/error-handler.middleware";
import { sanitizeInput, sanitizeInputWithAllowedKeys } from "./middlewares/sanitize.middleware";
import rootRouter from "./routes/index.route";
import { asyncHandler } from "./utils/asynchandler";
import logger from "./utils/logger";
import { getLocalIP } from "./utils/system.util";
import config from "./config";

const app: Express = express();
// Proxy hops in front of the API (1 behind the ALB); never "true", which
// would let any client spoof X-Forwarded-For for rate limiting and audit IPs.
app.set("trust proxy", config.TRUST_PROXY);

// Manual CORS middleware - handles both preflight and actual requests
const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  // Reflect the origin only when it is allowed. CORS_ORIGINS is a comma
  // separated allowlist; when it is empty (local development) any origin is
  // reflected. assertProductionConfig() refuses an empty list in production.
  const allowed =
    !!origin &&
    (config.CORS_ORIGINS.length === 0 || config.CORS_ORIGINS.includes(origin));
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Tenant-Id, X-Tenant-Host");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, X-Content-Range");
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
};

// Apply CORS middleware first - before anything else
app.use(corsMiddleware);

// Razorpay webhook needs raw body for signature verification - must be before express.json
app.use(
  "/api/v1/webhook",
  express.raw({ type: "application/json" }),
  webhookRouter
);

// Body parser - must come before sanitization middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 2. Helmet for security headers (after CORS so preflight is handled first)
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
// A conditional middleware runs only ONE sanitizer per request: a scoped one
// for the routes listed below, the global one for everything else.
// Lesson resource rich text ("content") carries editor HTML with <img> tags.
// so the key is allowlisted, scoped to the resources endpoints.
const lessonResourceSanitizer = sanitizeInputWithAllowedKeys(["content"]);
const LESSON_RESOURCES_RE = /^\/api\/v1\/tenant\/courses\/[^/]+\/lessons\/[^/]+\/resources/;
// Custom-code pages carry a full HTML document (with <style>/<script>) in
// customHtml/customHtmlDraft. It is rendered inside a sandboxed, opaque-origin
// iframe on the storefront, never injected into our DOM, so stripping tags
// here would only break the tenant's page without adding safety. Allow those
// keys through raw on the pages endpoints; everything else stays sanitized.
//
// "sections" is exempt for a different reason: it holds PLAIN TEXT, not HTML.
// DOMPurify treats every string as markup, so a tenant writing
// "rating > 4.5" got "rating &gt; 4.5" persisted, and "return <Layout />"
// silently lost the tag, corruption on save, with no safety gained. Section
// content is rendered exclusively through React text nodes, which escape on
// output; every dangerouslySetInnerHTML inside the section components is a
// static <style> block with no interpolation (enforced by
// packages/core/src/components/section-editor/__tests__/no-raw-content-html.test.ts).
// Note this deliberately does NOT cover "metadata" or "seo", those still flow
// into JSON-LD via JSON.stringify, so they stay sanitized.
const customCodeSanitizer = sanitizeInputWithAllowedKeys([
  "customHtml",
  "customHtmlDraft",
  "sections",
]);
app.use((req: Request, res: Response, next: NextFunction) => {
  if (LESSON_RESOURCES_RE.test(req.originalUrl)) {
    return lessonResourceSanitizer(req, res, next);
  }
  if (req.originalUrl.startsWith("/api/v1/pages")) {
    return customCodeSanitizer(req, res, next);
  }
  return sanitizeInput(req, res, next);
});

app.use("/api", rootRouter);

// Catch-all route for 404 - no path parameter needed in Express 5
app.use(asyncHandler(notFound));

app.use((
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any, req: Request, res: Response, next: NextFunction
) => {
  globalHandler(data, req, res, next);
});

logger.info(`Local IP - ${getLocalIP()}`);

export default app;
