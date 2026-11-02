/**
 * Email Engine, AWS Infrastructure Bootstrap
 * ============================================================================
 *
 * Idempotent provisioning script. Run once per AWS environment
 * (local, development, production). Safe to re-run; existing resources
 * are detected and skipped.
 *
 * Resource-set sharing:
 *   `local` and `development` share ONE set of AWS resources
 *   (suffix `-development`) so a developer running the stack on their
 *   laptop hits the same SNS / SQS / SES config set as the deployed
 *   development environment. `production` is fully isolated.
 *
 * Provisions:
 *   1. SNS topic           ses-events-{env}
 *   2. SQS DLQ             ses-events-{env}-dlq          (retention 14d)
 *   3. SQS main queue      ses-events-{env}-queue        (visibility 60s,
 *                                                         retention 14d,
 *                                                         redrive after 5)
 *   4. SQS access policy   allow SNS topic to publish to the main queue
 *   5. SNS subscription    main queue <- topic (raw delivery enabled)
 *   6. SES config set      email-default-{env}           (reputation tracking)
 *   7. SES event dest.     send all 9 event types -> SNS topic
 *
 * Usage:
 *   cd apps/admin-api
 *   pnpm tsx scripts/email-engine-bootstrap.ts --env=local
 *   pnpm tsx scripts/email-engine-bootstrap.ts --env=development
 *   pnpm tsx scripts/email-engine-bootstrap.ts --env=production
 *
 * Required env vars (or fall back to whatever AWS_PROFILE provides):
 *   AWS_REGION or AWS_SES_REGION      (default us-east-1)
 *   AWS_ACCOUNT_ID                    (required for ARN composition)
 *   AWS_ACCESS_KEY_ID                 (or rely on AWS_PROFILE / IAM role)
 *   AWS_SECRET_ACCESS_KEY             (or rely on AWS_PROFILE / IAM role)
 *
 * The script prints the resulting ARNs + URLs at the end. Copy them into the
 * deployment .env files of each backend:
 *   SES_EVENTS_SNS_TOPIC_ARN
 *   SES_EVENTS_QUEUE_URL
 *   SES_EVENTS_DLQ_URL
 * ============================================================================
 */

import {
  SNSClient,
  CreateTopicCommand,
  SubscribeCommand,
  SetSubscriptionAttributesCommand,
  ListSubscriptionsByTopicCommand,
} from "@aws-sdk/client-sns";
import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  SetQueueAttributesCommand,
  QueueDoesNotExist,
} from "@aws-sdk/client-sqs";
import {
  SESv2Client,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  GetConfigurationSetCommand,
  GetConfigurationSetEventDestinationsCommand,
  UpdateConfigurationSetEventDestinationCommand,
  NotFoundException,
  AlreadyExistsException,
  EventType,
} from "@aws-sdk/client-sesv2";

// ---------------------------------------------------------------------------
// CLI args + config
// ---------------------------------------------------------------------------

type EnvName = "local" | "development" | "production";

const VALID_ENVS: EnvName[] = ["local", "development", "production"];

function normalizeEnv(raw: string): EnvName {
  // Accept common shorthands so existing tooling keeps working, but
  // canonicalize to the three allowed names in the resource suffix.
  const lower = raw.toLowerCase();
  if (lower === "dev" || lower === "development") return "development";
  if (lower === "prod" || lower === "production") return "production";
  if (lower === "local" || lower === "localhost") return "local";
  return lower as EnvName;
}

function parseArgs(): { env: EnvName; region: string; accountId: string } {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([\w-]+)=(.+)$/);
    if (m) args.set(m[1]!, m[2]!);
  }
  const rawEnv = args.get("env") ?? process.env.NODE_ENV ?? "local";
  const env = normalizeEnv(rawEnv);
  if (!VALID_ENVS.includes(env)) {
    throw new Error(
      `Invalid --env=${rawEnv}. Must be one of ${VALID_ENVS.join(", ")} (aliases: dev, prod accepted).`,
    );
  }
  const region =
    args.get("region") ??
    process.env.AWS_SES_REGION ??
    process.env.AWS_REGION ??
    "us-east-1";
  const accountId = args.get("account") ?? process.env.AWS_ACCOUNT_ID ?? "";
  if (!accountId) {
    throw new Error(
      "AWS_ACCOUNT_ID is required (set env var or pass --account=123456789012).",
    );
  }
  return { env, region, accountId };
}

const { env, region, accountId } = parseArgs();

// local and development share one set of AWS resources so devs can hit the
// same SNS topic / SQS queue / SES config set as the development backend.
// production gets its own isolated set. The `env` argument still drives
// where the script *runs from* (CLI ergonomics + logging), but resource
// names are keyed off `resourceEnv`.
type ResourceEnv = "development" | "production";
const resourceEnv: ResourceEnv = env === "production" ? "production" : "development";

const topicName = `ses-events-${resourceEnv}`;
const mainQueueName = `ses-events-${resourceEnv}-queue`;
const dlqName = `ses-events-${resourceEnv}-dlq`;
const configSetName = `email-default-${resourceEnv}`;
const eventDestinationName = "sns-fanout";

const topicArn = `arn:aws:sns:${region}:${accountId}:${topicName}`;
const mainQueueArn = `arn:aws:sqs:${region}:${accountId}:${mainQueueName}`;
const dlqArn = `arn:aws:sqs:${region}:${accountId}:${dlqName}`;

const sns = new SNSClient({ region });
const sqs = new SQSClient({ region });
const ses = new SESv2Client({ region });

// All 9 SES event types we tag the default destination with.
const ALL_EVENT_TYPES: EventType[] = [
  EventType.SEND,
  EventType.DELIVERY,
  EventType.BOUNCE,
  EventType.COMPLAINT,
  EventType.REJECT,
  EventType.OPEN,
  EventType.CLICK,
  EventType.RENDERING_FAILURE,
  EventType.DELIVERY_DELAY,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logStep(step: string) {
  console.log(`\n--- ${step} ---`);
}

function logOk(message: string) {
  console.log(`  ok  ${message}`);
}

function logSkip(message: string) {
  console.log(`  --  ${message} (already exists)`);
}

async function getQueueUrlOrNull(queueName: string): Promise<string | null> {
  try {
    const out = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
    return out.QueueUrl ?? null;
  } catch (err) {
    if (err instanceof QueueDoesNotExist) return null;
    if ((err as { name?: string }).name === "AWS.SimpleQueueService.NonExistentQueue") {
      return null;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1. SNS topic
// ---------------------------------------------------------------------------

async function ensureSnsTopic(): Promise<string> {
  logStep(`SNS topic ${topicName}`);
  // CreateTopic is idempotent, returns existing ARN if name+attrs match.
  const out = await sns.send(new CreateTopicCommand({ Name: topicName }));
  const arn = out.TopicArn ?? topicArn;
  logOk(`topic arn ${arn}`);
  return arn;
}

// ---------------------------------------------------------------------------
// 2-3. SQS DLQ + main queue
// ---------------------------------------------------------------------------

async function ensureDlq(): Promise<string> {
  logStep(`SQS DLQ ${dlqName}`);
  const existing = await getQueueUrlOrNull(dlqName);
  if (existing) {
    logSkip(`queue url ${existing}`);
    return existing;
  }
  const out = await sqs.send(
    new CreateQueueCommand({
      QueueName: dlqName,
      Attributes: {
        MessageRetentionPeriod: String(14 * 24 * 3600), // 14 days
      },
    }),
  );
  if (!out.QueueUrl) throw new Error("DLQ creation returned no URL");
  logOk(`queue url ${out.QueueUrl}`);
  return out.QueueUrl;
}

async function ensureMainQueue(
  resolvedDlqArn: string,
  resolvedTopicArn: string,
): Promise<string> {
  logStep(`SQS main queue ${mainQueueName}`);
  const existing = await getQueueUrlOrNull(mainQueueName);
  let queueUrl: string;
  if (existing) {
    logSkip(`queue url ${existing}`);
    queueUrl = existing;
  } else {
    const out = await sqs.send(
      new CreateQueueCommand({
        QueueName: mainQueueName,
        Attributes: {
          VisibilityTimeout: "60",
          MessageRetentionPeriod: String(14 * 24 * 3600),
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: resolvedDlqArn,
            maxReceiveCount: "5",
          }),
        },
      }),
    );
    if (!out.QueueUrl) throw new Error("Main queue creation returned no URL");
    queueUrl = out.QueueUrl;
    logOk(`queue url ${queueUrl}`);
  }

  // Always reapply attributes, covers the case where the queue exists but
  // was provisioned without redrive or with a different visibility timeout.
  await sqs.send(
    new SetQueueAttributesCommand({
      QueueUrl: queueUrl,
      Attributes: {
        VisibilityTimeout: "60",
        MessageRetentionPeriod: String(14 * 24 * 3600),
        RedrivePolicy: JSON.stringify({
          deadLetterTargetArn: resolvedDlqArn,
          maxReceiveCount: "5",
        }),
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "allow-sns-topic-to-publish",
              Effect: "Allow",
              Principal: { Service: "sns.amazonaws.com" },
              Action: "sqs:SendMessage",
              Resource: mainQueueArn,
              Condition: { ArnEquals: { "aws:SourceArn": resolvedTopicArn } },
            },
          ],
        }),
      },
    }),
  );
  logOk("attributes + access policy applied");

  return queueUrl;
}

// ---------------------------------------------------------------------------
// 4. SNS -> SQS subscription (with RAW message delivery)
// ---------------------------------------------------------------------------

async function ensureSubscription(
  resolvedTopicArn: string,
  resolvedQueueArn: string,
): Promise<string> {
  logStep(`SNS subscription ${topicName} -> ${mainQueueName}`);
  const list = await sns.send(
    new ListSubscriptionsByTopicCommand({ TopicArn: resolvedTopicArn }),
  );
  const existing = list.Subscriptions?.find(
    (s) => s.Protocol === "sqs" && s.Endpoint === resolvedQueueArn,
  );
  let subscriptionArn: string;
  if (existing?.SubscriptionArn && existing.SubscriptionArn !== "PendingConfirmation") {
    logSkip(`subscription arn ${existing.SubscriptionArn}`);
    subscriptionArn = existing.SubscriptionArn;
  } else {
    const out = await sns.send(
      new SubscribeCommand({
        TopicArn: resolvedTopicArn,
        Protocol: "sqs",
        Endpoint: resolvedQueueArn,
        ReturnSubscriptionArn: true,
      }),
    );
    if (!out.SubscriptionArn) {
      throw new Error("Subscribe returned no subscription ARN");
    }
    subscriptionArn = out.SubscriptionArn;
    logOk(`subscription arn ${subscriptionArn}`);
  }

  // Always reapply RawMessageDelivery, without it, every consumer must
  // unwrap an SNS envelope which is brittle.
  await sns.send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: subscriptionArn,
      AttributeName: "RawMessageDelivery",
      AttributeValue: "true",
    }),
  );
  logOk("raw message delivery enabled");
  return subscriptionArn;
}

// ---------------------------------------------------------------------------
// 5-6. SES configuration set + event destination
// ---------------------------------------------------------------------------

async function ensureConfigurationSet(): Promise<void> {
  logStep(`SES configuration set ${configSetName}`);
  try {
    await ses.send(
      new GetConfigurationSetCommand({ ConfigurationSetName: configSetName }),
    );
    logSkip("configuration set");
  } catch (err) {
    if (!(err instanceof NotFoundException)) throw err;
    try {
      await ses.send(
        new CreateConfigurationSetCommand({
          ConfigurationSetName: configSetName,
          ReputationOptions: { ReputationMetricsEnabled: true },
          SendingOptions: { SendingEnabled: true },
        }),
      );
      logOk("configuration set created");
    } catch (createErr) {
      if (!(createErr instanceof AlreadyExistsException)) throw createErr;
      logSkip("configuration set (race condition handled)");
    }
  }
}

async function ensureEventDestination(resolvedTopicArn: string): Promise<void> {
  logStep(`SES event destination ${eventDestinationName} -> ${topicName}`);
  const list = await ses.send(
    new GetConfigurationSetEventDestinationsCommand({
      ConfigurationSetName: configSetName,
    }),
  );
  const existing = list.EventDestinations?.find(
    (d) => d.Name === eventDestinationName,
  );
  const destinationInput = {
    Enabled: true,
    MatchingEventTypes: ALL_EVENT_TYPES,
    SnsDestination: { TopicArn: resolvedTopicArn },
  };
  if (existing) {
    await ses.send(
      new UpdateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: configSetName,
        EventDestinationName: eventDestinationName,
        EventDestination: destinationInput,
      }),
    );
    logOk("event destination updated (all 9 event types)");
  } else {
    await ses.send(
      new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: configSetName,
        EventDestinationName: eventDestinationName,
        EventDestination: destinationInput,
      }),
    );
    logOk("event destination created (all 9 event types)");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Bootstrapping email engine infrastructure`);
  console.log(`  env:           ${env}`);
  console.log(`  resource set:  ${resourceEnv}${env === "local" ? " (shared with local)" : ""}`);
  console.log(`  region:        ${region}`);
  console.log(`  account id:    ${accountId}`);

  const resolvedTopicArn = await ensureSnsTopic();
  const resolvedDlqUrl = await ensureDlq();
  const resolvedMainQueueUrl = await ensureMainQueue(
    dlqArn,
    resolvedTopicArn,
  );
  // Confirm DLQ arn matches what we used in redrive policy (paranoia check).
  const dlqAttrs = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: resolvedDlqUrl,
      AttributeNames: ["QueueArn"],
    }),
  );
  const actualDlqArn = dlqAttrs.Attributes?.QueueArn;
  if (actualDlqArn && actualDlqArn !== dlqArn) {
    throw new Error(
      `DLQ ARN mismatch: composed ${dlqArn}, actual ${actualDlqArn}. ` +
        `Re-run with --account set to the correct AWS account id.`,
    );
  }

  await ensureSubscription(resolvedTopicArn, mainQueueArn);
  await ensureConfigurationSet();
  await ensureEventDestination(resolvedTopicArn);

  console.log(`\n========================================================`);
  console.log(`Done. Copy these into each backend .env:`);
  console.log(`========================================================`);
  console.log(`SES_EVENTS_SNS_TOPIC_ARN=${resolvedTopicArn}`);
  console.log(`SES_EVENTS_QUEUE_URL=${resolvedMainQueueUrl}`);
  console.log(`SES_EVENTS_DLQ_URL=${resolvedDlqUrl}`);
  console.log(`\nSES configuration set ready: ${configSetName}`);
  console.log(`Per-tenant configuration sets (created at domain onboarding`);
  console.log(`time in Phase 3) will clone settings from this set.`);
}

main().catch((err) => {
  console.error("\nBootstrap failed:");
  console.error(err);
  process.exit(1);
});
