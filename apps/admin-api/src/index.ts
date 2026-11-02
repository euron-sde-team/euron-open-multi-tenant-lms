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
import { getRedisClient, closeRedisClient } from "./lib/redis";
import logger from "./utils/logger";
import {
  startFooterSyncSweep,
  stopFooterSyncSweep,
} from "./services/footer-generator.service";
import {
  startFxRefreshWorker,
  stopFxRefreshWorker,
} from "./queues/fx-refresh.worker";
import { fxRefreshQueue, registerFxRefreshJob } from "./queues/fx-refresh.queue";
import {
  startDomainVerificationWorker,
  stopDomainVerificationWorker,
  registerDomainVerificationJob,
  domainVerificationQueue,
  startEmailSendingDomainVerificationWorker,
  stopEmailSendingDomainVerificationWorker,
  registerEmailSendingDomainVerificationJob,
  emailSendingDomainVerificationQueue,
  startEmailSesEventsConsumer,
  stopEmailSesEventsConsumer,
  startEmailDlqMonitorWorker,
  stopEmailDlqMonitorWorker,
  registerEmailDlqMonitorJob,
  emailDlqMonitorQueue,
  startEmailReputationSweepWorker,
  stopEmailReputationSweepWorker,
  registerEmailReputationSweepJob,
  emailReputationSweepQueue,
  startEmailDomainHealthWorker,
  stopEmailDomainHealthWorker,
  registerEmailDomainHealthJob,
  emailDomainHealthQueue,
  startEmailAccountHealthWorker,
  stopEmailAccountHealthWorker,
  registerEmailAccountHealthJob,
  emailAccountHealthQueue,
  startGracePeriodExpiryWorker,
  stopGracePeriodExpiryWorker,
  registerGracePeriodExpiryJob,
  gracePeriodExpiryQueue,
  startSubscriptionPollReconciliationWorker,
  stopSubscriptionPollReconciliationWorker,
  registerSubscriptionPollReconciliationJob,
  subscriptionPollReconciliationQueue,
  startSubscriptionNotificationWorker,
  stopSubscriptionNotificationWorker,
  registerNotificationScheduleJob,
  subscriptionNotificationQueue,
  startUsageReconciliationWorker,
  stopUsageReconciliationWorker,
  registerUsageReconciliationJob,
  usageReconciliationQueue,
  startCourseAIWorker,
  stopCourseAIWorker,
  courseAIQueue,
  startOnboardingFinalizeWorker,
  stopOnboardingFinalizeWorker,
  onboardingFinalizeQueue,
  startBookAIWorker,
  stopBookAIWorker,
  bookAIQueue,
  startBatchAIWorker,
  stopBatchAIWorker,
  batchAIQueue,
  startPageImageAIWorker,
  stopPageImageAIWorker,
  pageImageAIQueue,
  startPagePlanAIWorker,
  stopPagePlanAIWorker,
  pagePlanAIQueue,
  startTestAIWorker,
  stopTestAIWorker,
  testAIQueue,
  startTestSeriesAIWorker,
  stopTestSeriesAIWorker,
  testSeriesAIQueue,
  startBulkImportsWorker,
  stopBulkImportsWorker,
  bulkImportsQueue,
  startAnalyticsExportWorker,
  stopAnalyticsExportWorker,
  analyticsExportQueue,
} from "./queues";

// Configuration
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds
const WORKER_RESTART_DELAY = 1000; // 1 second
const MAX_WORKER_RESTARTS = 10; // Max restarts within restart window
const RESTART_WINDOW = 60000; // 1 minute window

// Track worker restarts for rate limiting
const workerRestartCounts = new Map<
  number,
  { count: number; resetTime: number }
>();

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
    logger.info(
      `Worker ${process.pid} received ${signal}, starting graceful shutdown...`,
    );

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
  process.on("uncaughtException", (error: Error & { code?: string }) => {
    // EPIPE errors occur when writing to a closed socket (client disconnected)
    // These are not critical and should not crash the worker
    if (error.code === "EPIPE" || error.message === "write EPIPE") {
      logger.warn(
        `Worker ${process.pid} EPIPE error (client disconnected), continuing...`,
      );
      return; // Don't exit for EPIPE errors
    }

    logger.error(`Worker ${process.pid} uncaught exception:`, error);
    // Don't exit immediately, let the process manager handle it
    // This allows for proper logging and cleanup
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    logger.error(
      `Worker ${process.pid} unhandled rejection at:`,
      promise,
      "reason:",
      reason,
    );
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

    // Connect to database
    // Each worker establishes its own connection pool
    // This is necessary because workers are separate processes and cannot share memory
    logger.info(`Worker ${process.pid}: Connecting to Database...`);
    await waitForDBConnection();
    logger.info(`Worker ${process.pid}: DB connected successfully`);

    // Connect to Redis (cache + rate limiting)
    await getRedisClient();
    logger.info(`Worker ${process.pid}: Redis connected successfully`);

    const port = normalizePort(config.PORT || "5086");

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
          logger.error(
            `Worker ${process.pid}: ${bind} requires elevated privileges`,
          );
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

    // Background jobs (BullMQ workers + recurring schedulers + sweeps) run only
    // when enabled. The web ECS service sets RUN_JOB_WORKERS=false so request
    // handling is NEVER blocked by a background sweep/GC; a dedicated worker
    // service runs them. Default (unset) = enabled, so dev / single-service
    // deployments are unchanged. The HTTP server above always starts.
    const RUN_JOB_WORKERS = process.env.RUN_JOB_WORKERS !== "false";
    if (RUN_JOB_WORKERS) {
      // Background footer contact-info sync (polls org details into the footer every 5 min)
      startFooterSyncSweep();

      // FX refresh worker + the daily rate refresh. Rates are persisted, so a
      // missed run degrades to a slightly older rate.
      startFxRefreshWorker();
      await registerFxRefreshJob();

      // Bulk imports (async CSV/XLSX onboarding jobs)
      startBulkImportsWorker();

      // Analytics exports (CSV/XLSX files built off the request path)
      startAnalyticsExportWorker();

      // Storefront custom-domain verification + recurring poll
      startDomainVerificationWorker();
      await registerDomainVerificationJob();

      // SES sending-domain verification (distinct from storefront domains), 60s poll
      startEmailSendingDomainVerificationWorker();
      await registerEmailSendingDomainVerificationJob();

      // SES events consumer (sqs-consumer, not BullMQ) + DLQ monitor. The
      // consumer no-ops when SES_EVENTS_QUEUE_URL is not configured.
      startEmailSesEventsConsumer();
      startEmailDlqMonitorWorker();
      await registerEmailDlqMonitorJob();

      // Reputation enforcer sweep (every 10 min). PAUSED is never auto-recovered.
      startEmailReputationSweepWorker();
      await registerEmailReputationSweepJob();

      // Domain health monitor (daily 03:00 UTC): flips VERIFIED to FAILED after
      // 24h of continuous DNS failure so sends fall back to the shared sender.
      startEmailDomainHealthWorker();
      await registerEmailDomainHealthJob();

      // Account-wide emergency brake (every 5 min).
      startEmailAccountHealthWorker();
      await registerEmailAccountHealthJob();

      // Platform subscription lifecycle
      startGracePeriodExpiryWorker();
      await registerGracePeriodExpiryJob();
      startSubscriptionPollReconciliationWorker();
      await registerSubscriptionPollReconciliationJob();
      startSubscriptionNotificationWorker();
      await registerNotificationScheduleJob();

      // Usage reconciliation (every 6 hours)
      startUsageReconciliationWorker();
      await registerUsageReconciliationJob();

      // AI authoring workers
      startCourseAIWorker();
      startOnboardingFinalizeWorker();
      startTestAIWorker();
      startTestSeriesAIWorker();
      startBookAIWorker();
      startBatchAIWorker();
      startPageImageAIWorker();
      startPagePlanAIWorker();
    } // end if (RUN_JOB_WORKERS)

    // Graceful shutdown handlers
    //
    // Guarded because there are now three ways in: SIGTERM, SIGINT, and the
    // master's IPC channel closing. Ctrl-C hits the whole process group, so
    // SIGINT and `disconnect` can both fire within the same tick, without
    // this flag the queue `.close()` calls below would run twice concurrently.
    let isShuttingDown = false;

    /**
     * The teardown steps. Never call this directly, go through `shutdown`,
     * which owns the re-entrancy guard, the failure handling and the deadline.
     */
    const shutdownSteps = async (signal: string) => {
      await closeRedisClient();
      stopFooterSyncSweep();
      await stopFxRefreshWorker();
      await fxRefreshQueue.close();
      await stopBulkImportsWorker();
      await bulkImportsQueue.close();
      await stopAnalyticsExportWorker();
      await analyticsExportQueue.close();
      await stopDomainVerificationWorker();
      await domainVerificationQueue.close();
      await stopEmailSendingDomainVerificationWorker();
      await emailSendingDomainVerificationQueue.close();
      await stopEmailSesEventsConsumer();
      await stopEmailDlqMonitorWorker();
      await emailDlqMonitorQueue.close();
      await stopEmailReputationSweepWorker();
      await emailReputationSweepQueue.close();
      await stopEmailDomainHealthWorker();
      await emailDomainHealthQueue.close();
      await stopEmailAccountHealthWorker();
      await emailAccountHealthQueue.close();
      await stopGracePeriodExpiryWorker();
      await gracePeriodExpiryQueue.close();
      await stopSubscriptionPollReconciliationWorker();
      await subscriptionPollReconciliationQueue.close();
      await stopSubscriptionNotificationWorker();
      await subscriptionNotificationQueue.close();
      await stopUsageReconciliationWorker();
      await usageReconciliationQueue.close();
      await stopCourseAIWorker();
      await courseAIQueue.close();
      await stopOnboardingFinalizeWorker();
      await onboardingFinalizeQueue.close();
      await stopTestAIWorker();
      await testAIQueue.close();
      await stopTestSeriesAIWorker();
      await testSeriesAIQueue.close();
      await stopBookAIWorker();
      await bookAIQueue.close();
      await stopBatchAIWorker();
      await batchAIQueue.close();
      await stopPageImageAIWorker();
      await pageImageAIQueue.close();
      await stopPagePlanAIWorker();
      await pagePlanAIQueue.close();
      await gracefulShutdown(server, signal);
      // Database connections will be automatically closed by the pool's idle timeout
      // and cleaned up when the process exits
      logger.info(`Worker ${process.pid}: Shutdown complete`);
    };

    /**
     * THE ORPHAN FIX.
     *
     * `shutdownSteps` is ~30 sequential awaits. Before this wrapper existed the
     * only `process.exit()` sat after the last one, there was no try/catch, and
     * the `unhandledRejection` handler above deliberately does not exit. So a
     * single queue close that threw or hung meant the exit was never reached:
     * the worker stayed alive with every not-yet-closed BullMQ worker still
     * polling Redis, the master exited without it, and the worker was
     * reparented to PID 1, the process that outlives the terminal and keeps
     * printing cron logs into a fresh prompt.
     *
     * Two guarantees, so that can no longer happen:
     *   1. A failure anywhere is caught, logged, and still exits.
     *   2. A hang is capped by a deadline that force-exits regardless.
     *
     * The timer is unref'd: if teardown finishes early and nothing else holds
     * the loop open, the process exits on its own rather than waiting it out.
     */
    const SHUTDOWN_DEADLINE_MS = 15_000;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      const deadline = setTimeout(() => {
        logger.error(
          `Worker ${process.pid}: shutdown exceeded ${SHUTDOWN_DEADLINE_MS}ms after ${signal}, forcing exit`,
        );
        process.exit(1);
      }, SHUTDOWN_DEADLINE_MS);
      deadline.unref();

      let code = 0;
      try {
        await shutdownSteps(signal);
      } catch (error) {
        code = 1;
        logger.error(
          `Worker ${process.pid}: shutdown failed after ${signal}, exiting anyway:`,
          error,
        );
      }
      clearTimeout(deadline);
      process.exit(code);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    /**
     * THE MASTER IS GONE. GO WITH IT.
     *
     * The third way in that the shutdown guard above already names, and the one
     * that was never wired up. A worker only heard about shutdown through a
     * SIGNAL, so any death of the master that sends none, `tsx watch`
     * restarting on a file change, a SIGKILL, a crashed master, left every
     * worker alive and reparented to init.
     *
     * They are not idle when that happens. They hold their BullMQ
     * subscriptions, so an orphan from a build two hours ago competes for queue
     * runs with the process actually serving the developer, claims one, and
     * executes it against STALE CODE. What that looks like from the outside is
     * a run that sits "processing" forever: the job is claimed, the lock is
     * held by a process nobody knows about, and the fix that was just deployed
     * appears not to work. It cost this project several hours of debugging
     * across a dozen runs before the pattern was recognised.
     *
     * `disconnect` fires on the worker the moment the master's IPC channel
     * closes, whatever killed it. Shutting down there is what keeps a reload a
     * reload instead of a fork bomb of stale consumers.
     */
    process.on("disconnect", () => {
      logger.warn(
        `Worker ${process.pid}: master went away (IPC channel closed), shutting down rather than orphaning`
      );
      void shutdown("master-disconnect");
    });

    logger.info(`Worker ${process.pid} started`);
  } catch (error) {
    logger.error(`Worker ${process.pid}: Failed to start:`, error);
    process.exit(1);
  }
};

// Master process code
const startMaster = () => {
  logger.info(`Master ${process.pid} is running`);

  /**
   * True once the master has begun shutting down.
   *
   * Ctrl-C (and any SIGTERM sent to the process group) reaches the master AND
   * every worker at the same time. The workers exit on their own, the master's
   * `cluster.on("exit")` handler below sees them die, and without this flag it
   * cheerfully forks replacements, which boot all ~30 BullMQ workers again and
   * outlive the terminal as orphans. On a deploy it is the same story: SIGTERM
   * forks fresh workers that connect to Redis and Postgres only to be SIGKILLed
   * seconds later.
   *
   * A worker that dies while the master is healthy still restarts as before.
   */
  let isShuttingDown = false;

  const numCPUs = process.env.NODE_ENV === "production" ? os.cpus().length : 1;
  logger.info(`Forking ${numCPUs} worker(s)...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    forkWorker();
  }

  // Handle worker exit with restart logic
  cluster.on("exit", (worker: Worker, code: number, signal: string) => {
    // Deliberate shutdown: a dead worker is the point, not a failure to recover from.
    if (isShuttingDown) {
      logger.info(
        `Worker ${worker.process.pid} exited during shutdown; not restarting`,
      );
      return;
    }

    const workerId = worker.id;
    logger.warn(
      `Worker ${worker.process.pid} (ID: ${workerId}) died with code ${code} and signal ${signal}`,
    );

    // Check restart rate limit
    const now = Date.now();
    const restartInfo = workerRestartCounts.get(workerId) || {
      count: 0,
      resetTime: now + RESTART_WINDOW,
    };

    // Reset counter if window expired
    if (now > restartInfo.resetTime) {
      restartInfo.count = 0;
      restartInfo.resetTime = now + RESTART_WINDOW;
    }

    restartInfo.count++;

    if (restartInfo.count > MAX_WORKER_RESTARTS) {
      logger.error(
        `Worker ${workerId} exceeded max restarts (${MAX_WORKER_RESTARTS}) within ${RESTART_WINDOW}ms. Not restarting.`,
      );
      workerRestartCounts.delete(workerId);
      return;
    }

    workerRestartCounts.set(workerId, restartInfo);

    // Restart worker after delay
    logger.info(
      `Restarting worker ${workerId} in ${WORKER_RESTART_DELAY}ms... (restart ${restartInfo.count}/${MAX_WORKER_RESTARTS})`,
    );
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
    // Set before anything can await, so a worker that dies in the very next tick
    // is already covered by the guard in cluster.on("exit").
    isShuttingDown = true;
    logger.info(
      `Master ${process.pid} received ${signal}, shutting down workers...`,
    );

    const workers = Object.values(cluster.workers || {});
    const shutdownPromises = workers.map((worker) => {
      return new Promise<void>((resolve) => {
        if (!worker) {
          resolve();
          return;
        }

        logger.info(
          `Sending shutdown signal to worker ${worker.process.pid}...`,
        );
        worker.disconnect();

        const timeout = setTimeout(() => {
          logger.warn(
            `Worker ${worker.process.pid} did not exit gracefully, killing...`,
          );
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
    logger.error(
      `Master ${process.pid} unhandled rejection at:`,
      promise,
      "reason:",
      reason,
    );
  });
};

// Fork a new worker
const forkWorker = (): Worker | undefined => {
  try {
    const worker = cluster.fork();
    const workerId = worker.id;

    // Reset restart count for new worker
    workerRestartCounts.set(workerId, {
      count: 0,
      resetTime: Date.now() + RESTART_WINDOW,
    });

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
    assertProductionConfig();
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
