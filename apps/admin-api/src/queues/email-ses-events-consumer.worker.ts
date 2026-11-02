/**
 * SES events consumer, long-polls the SQS queue populated by the SNS topic
 * subscribed to every per-tenant SES configuration set.
 *
 * Distinct from BullMQ workers: uses `sqs-consumer` directly because the
 * queue is AWS SQS, not Redis. Lives in `src/queues/` for organizational
 * consistency with the other background workers.
 *
 * Batch processing: each batch returns successfully-processed messages so
 * sqs-consumer deletes them. Failed messages are NOT returned, so they stay
 * in the queue for retry (after visibility timeout). After 5 retries SQS
 * redrives to the DLQ (configured by the bootstrap script in Phase 2).
 *
 * Idempotency lives in the event handler (UPDATE ... WHERE timestamp IS NULL).
 * The consumer itself is dumb, it just routes messages.
 */

import { Consumer } from "sqs-consumer";
import { SQSClient } from "@aws-sdk/client-sqs";
import config from "../config";
import { handleSesEvent } from "../services/email-engine/ses-event-handler.service";
import logger from "../utils/logger";

let consumer: Consumer | null = null;

function buildSqsClient(): SQSClient {
  return new SQSClient({
    region: config.AWS_SES_REGION,
    credentials: {
      accessKeyId: config.AWS_SES_ACCESS_KEY,
      secretAccessKey: config.AWS_SES_SECRET_KEY,
    },
  });
}

export function startEmailSesEventsConsumer(): void {
  if (!config.SES_EVENTS_QUEUE_URL) {
    logger.warn(
      "[email-ses-events-consumer] SES_EVENTS_QUEUE_URL is not configured; consumer NOT started. Run infra/email-engine bootstrap and set the URL in .env.",
    );
    return;
  }

  consumer = Consumer.create({
    queueUrl: config.SES_EVENTS_QUEUE_URL,
    sqs: buildSqsClient(),
    batchSize: 10,
    waitTimeSeconds: 20, // long polling
    visibilityTimeout: 60,
    heartbeatInterval: 20,
    handleMessageBatch: async (messages) => {
      const succeeded: typeof messages = [];
      for (const message of messages) {
        try {
          if (!message.Body) {
            // Empty body is malformed; drop by considering it processed so
            // it doesn't loop forever and eventually DLQ.
            logger.warn(
              `[email-ses-events-consumer] Empty message body; dropping`,
            );
            succeeded.push(message);
            continue;
          }
          const event = JSON.parse(message.Body);
          await handleSesEvent(event);
          succeeded.push(message);
        } catch (err) {
          logger.error(
            `[email-ses-events-consumer] handler failed for messageId=${message.MessageId}:`,
            err,
          );
          // Don't push, message stays in queue, will retry until DLQ.
        }
      }
      // Returning messages = they get deleted from SQS. The ones we omit
      // (failed) are left for re-delivery.
      return succeeded;
    },
  });

  consumer.on("error", (err) => {
    logger.error("[email-ses-events-consumer] consumer error:", err);
  });
  consumer.on("processing_error", (err) => {
    logger.error("[email-ses-events-consumer] processing error:", err);
  });
  consumer.on("timeout_error", (err) => {
    logger.warn("[email-ses-events-consumer] timeout:", err);
  });

  consumer.start();
  logger.info(
    `[email-ses-events-consumer] Started; polling ${config.SES_EVENTS_QUEUE_URL}`,
  );
}

export async function stopEmailSesEventsConsumer(): Promise<void> {
  if (consumer) {
    consumer.stop();
    consumer = null;
    logger.info("[email-ses-events-consumer] Stopped");
  }
}
