/* eslint-disable @typescript-eslint/no-explicit-any */

// Force UTC timezone for the entire process.
// pg serializes Date objects using local getters (getHours, etc.), but our
// setTypeParser(1114) reads timestamps as UTC. Without TZ=UTC, writes use
// local time while reads assume UTC, causing a timezone-offset shift.
process.env.TZ = "UTC";

import cluster, { Worker } from "cluster";
import { Server } from "http";
import os from "os";
import app from "./app";
import config, { assertProductionConfig } from "./config";
import { waitForDBConnection } from "./db/connection";
import logger from "./utils/logger";

// Configuration
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds
const WORKER_RESTART_DELAY = 1000; // 1 second
const MAX_WORKER_RESTARTS = 10; // Max restarts within restart window
const RESTART_WINDOW = 60000; // 1 minute window

// Track worker restarts for rate limiting
const workerRestartCounts = new Map<number, { count: number; resetTime: number }>();

// Normalize port helper
const normalizePort = (val: any): number | string | false => {
  const port = parseInt(val, 10);

  if (Number.isNaN(port)) {
    // Named pipe
    return val;
  }

  if (port >= 0) {
    // Port number
    return port;
  }

  return false;
};

// Graceful shutdown helper for workers
const gracefulShutdown = (server: Server, signal: string) => {
  return new Promise<void>((resolve) => {
    logger.info(`Worker ${process.pid} received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info(`Worker ${process.pid} closed all connections`);
      resolve();
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error(`Worker ${process.pid} forced shutdown after timeout`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
  });
};

// Setup error handlers for workers
const setupWorkerErrorHandlers = () => {
  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    logger.error(`Worker ${process.pid} uncaught exception:`, error);
    // Don't exit immediately, let the process manager handle it
    // This allows for proper logging and cleanup
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    logger.error(`Worker ${process.pid} unhandled rejection at:`, promise, "reason:", reason);
    // Log but don't exit - let the application continue
    // In production, you might want to exit here depending on your strategy
  });

  // Handle warnings
  process.on("warning", (warning: Error) => {
    logger.warn(`Worker ${process.pid} warning:`, warning);
  });
};

// Worker process code
const startWorker = async () => {
  try {
    // Setup error handlers first
    setupWorkerErrorHandlers();
    assertProductionConfig();

    // Connect to database
    // Each worker establishes its own connection pool
    // This is necessary because workers are separate processes and cannot share memory
    logger.info(`Worker ${process.pid}: Connecting to Database...`);
    await waitForDBConnection();
    logger.info(`Worker ${process.pid}: DB connected successfully`);

    const port = normalizePort(config.PORT || "5076");

    if (port === false) {
      logger.error(`Worker ${process.pid}: Invalid port ${config.PORT}`);
      process.exit(1);
    }

    const onError = (error: any) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      const bind = typeof port === "string" ? `pipe ${port}` : `port ${port}`;
      switch (error.code) {
        case "EACCES":
          logger.error(`Worker ${process.pid}: ${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case "EADDRINUSE":
          logger.error(`Worker ${process.pid}: ${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    };

    const onListening = () => {
      const bind = typeof port === "string" ? `pipe ${port}` : `port ${port}`;
      logger.info(`Worker ${process.pid}: Listening on ${bind}`);
      logger.info(`Worker ${process.pid}: Server started successfully!`);

      // Notify master that worker is ready
      if (process.send) {
        process.send({ type: "ready" });
      }
    };

    const server = app.listen(port, onListening);
    server.on("error", onError);

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      await gracefulShutdown(server, signal);
      logger.info(`Worker ${process.pid}: Shutdown complete`);
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    logger.info(`Worker ${process.pid} started`);
  } catch (error) {
    logger.error(`Worker ${process.pid}: Failed to start:`, error);
    process.exit(1);
  }
};

// Master process code
const startMaster = () => {
  logger.info(`Master ${process.pid} is running`);

  const numCPUs = process.env.NODE_ENV === "production" ? os.cpus().length : 1;
  logger.info(`Forking ${numCPUs} worker(s)...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    forkWorker();
  }

  // Handle worker exit with restart logic
  cluster.on("exit", (worker: Worker, code: number, signal: string) => {
    const workerId = worker.id;
    logger.warn(
      `Worker ${worker.process.pid} (ID: ${workerId}) died with code ${code} and signal ${signal}`
    );

    // Check restart rate limit
    const now = Date.now();
    const restartInfo = workerRestartCounts.get(workerId) || { count: 0, resetTime: now + RESTART_WINDOW };

    // Reset counter if window expired
    if (now > restartInfo.resetTime) {
      restartInfo.count = 0;
      restartInfo.resetTime = now + RESTART_WINDOW;
    }

    restartInfo.count++;

    if (restartInfo.count > MAX_WORKER_RESTARTS) {
      logger.error(
        `Worker ${workerId} exceeded max restarts (${MAX_WORKER_RESTARTS}) within ${RESTART_WINDOW}ms. Not restarting.`
      );
      workerRestartCounts.delete(workerId);
      return;
    }

    workerRestartCounts.set(workerId, restartInfo);

    // Restart worker after delay
    logger.info(`Restarting worker ${workerId} in ${WORKER_RESTART_DELAY}ms... (restart ${restartInfo.count}/${MAX_WORKER_RESTARTS})`);
    setTimeout(() => {
      forkWorker();
    }, WORKER_RESTART_DELAY);
  });

  // Handle online event (worker is ready)
  cluster.on("online", (worker: Worker) => {
    logger.info(`Worker ${worker.process.pid} (ID: ${worker.id}) is online`);
  });

  // Handle disconnect event
  cluster.on("disconnect", (worker: Worker) => {
    logger.warn(`Worker ${worker.process.pid} (ID: ${worker.id}) disconnected`);
  });

  // Graceful shutdown for master
  const shutdownMaster = async (signal: string) => {
    logger.info(`Master ${process.pid} received ${signal}, shutting down workers...`);

    const workers = Object.values(cluster.workers || {});
    const shutdownPromises = workers.map((worker) => {
      return new Promise<void>((resolve) => {
        if (!worker) {
          resolve();
          return;
        }

        logger.info(`Sending shutdown signal to worker ${worker.process.pid}...`);
        worker.disconnect();

        const timeout = setTimeout(() => {
          logger.warn(`Worker ${worker.process.pid} did not exit gracefully, killing...`);
          worker.kill("SIGKILL");
          resolve();
        }, SHUTDOWN_TIMEOUT);

        worker.once("exit", () => {
          clearTimeout(timeout);
          logger.info(`Worker ${worker.process.pid} exited`);
          resolve();
        });
      });
    });

    await Promise.all(shutdownPromises);
    logger.info(`Master ${process.pid} shutting down`);
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdownMaster("SIGTERM"));
  process.on("SIGINT", () => shutdownMaster("SIGINT"));

  // Handle master errors
  process.on("uncaughtException", (error: Error) => {
    logger.error(`Master ${process.pid} uncaught exception:`, error);
    shutdownMaster("uncaughtException");
  });

  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    logger.error(`Master ${process.pid} unhandled rejection at:`, promise, "reason:", reason);
  });
};

// Fork a new worker
const forkWorker = (): Worker | undefined => {
  try {
    const worker = cluster.fork();
    const workerId = worker.id;

    // Reset restart count for new worker
    workerRestartCounts.set(workerId, { count: 0, resetTime: Date.now() + RESTART_WINDOW });

    // Handle worker messages
    worker.on("message", (message: any) => {
      if (message.type === "ready") {
        logger.info(`Worker ${worker.process.pid} (ID: ${workerId}) is ready`);
      }
    });

    return worker;
  } catch (error) {
    logger.error("Failed to fork worker:", error);
    return undefined;
  }
};

// Main entry point
(async () => {
  try {
    if (cluster.isPrimary) {
      startMaster();
    } else {
      await startWorker();
    }
  } catch (error) {
    logger.error("Failed to start the server:", error);
    process.exit(1);
  }
})();
