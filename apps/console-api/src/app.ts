import express, { Express, NextFunction, Request, Response } from "express";

// @ts-ignore
import cors from "cors";
import helmet from "helmet";
import { notFound } from "./controllers/health.controller";
import { globalHandler } from "./middlewares/error-handler.middleware";
import { sanitizeInput } from "./middlewares/sanitize.middleware";
import rootRouter from "./routes/index.route";
import { asyncHandler } from "./utils/asynchandler";
import logger from "./utils/logger";
import { getLocalIP } from "./utils/system.util";
import config from "./config";

const app: Express = express();
// Proxy hops in front of the API (1 behind the ALB); never "true", which
// would let any client spoof X-Forwarded-For for rate limiting and audit IPs.
app.set("trust proxy", config.TRUST_PROXY);

// Body parser - must come before sanitization middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security middleware - order matters!
// 1. Helmet for security headers (including XSS protection)
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
    frameguard: { action: "deny" },
    xssFilter: true, // Enable XSS filter
  })
);

// 2. CORS
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || config.CORS_ORIGINS.includes(origin)),
  })
);

// 3. XSS Sanitization middleware (express-xss-sanitizer)
// Sanitizes req.body, req.query, req.params, and req.headers to prevent XSS attacks
// Express 5 compatible and actively maintained
// Note: For additional input validation, use express-validator in your route handlers
app.use(sanitizeInput);

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
