import { Queue } from "bullmq";
import { ulid } from "ulid";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const TEST_SERIES_AI_QUEUE_NAME = "test-series-ai-generation";

/**
 * Three flavours of test-series AI generation.
 *  - title: returns a short string
 *  - description: returns a paragraph
 *  - cover: returns a base64 image data URL (admin then uploads via existing
 *    upload flow). 16:9 banner sized like the existing course cover pipeline.
 */
export type TestSeriesAIKind = "title" | "description" | "cover";

export interface TestSeriesAITitleInput {
  kind: "title";
  /** Short topic/exam description the admin types in. May be empty. */
  topic?: string | null;
  /** Optional category to bias output. */
  category?: string | null;
}

export interface TestSeriesAIDescriptionInput {
  kind: "description";
  /** The series title (or working title). Required. */
  title: string;
  /** Optional category to bias tone. */
  category?: string | null;
  /** Optional extra context the admin typed. */
  extraContext?: string | null;
}

export interface TestSeriesAICoverInput {
  kind: "cover";
  /** The series title is rendered into the banner. Required. */
  title: string;
  /** Optional category for visual cues. */
  category?: string | null;
  /** Optional series description for additional context. */
  description?: string | null;
}

export type TestSeriesAIJobInput =
  | TestSeriesAITitleInput
  | TestSeriesAIDescriptionInput
  | TestSeriesAICoverInput;

export interface TestSeriesAIJobData {
  tenantId: string;
  input: TestSeriesAIJobInput;
  createdBy?: string | null;
}

export interface TestSeriesAIJobProgress {
  status: "pending" | "generating" | "completed" | "failed";
  kind: TestSeriesAIKind;
  /** Populated on completion. text for title/description, dataUrl for cover. */
  result?:
    | { kind: "title"; text: string }
    | { kind: "description"; text: string }
    | { kind: "cover"; dataUrl: string };
  error?: string;
}

export const testSeriesAIQueue = new Queue<TestSeriesAIJobData>(
  TEST_SERIES_AI_QUEUE_NAME,
  {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 1800 }, // 30 min, covers the polling window
      removeOnFail: { age: 86400 }, // 24h for debugging
    },
  }
);

/**
 * Submit a test-series AI generation job. Returns a tenant-scoped jobId so
 * the controller can authorize status queries by prefix.
 */
export async function submitTestSeriesAIJob(
  data: TestSeriesAIJobData
): Promise<string> {
  const jobId = `test-series-ai-${data.tenantId}-${ulid()}`;
  await testSeriesAIQueue.add(`generate-${data.input.kind}`, data, { jobId });
  return jobId;
}
