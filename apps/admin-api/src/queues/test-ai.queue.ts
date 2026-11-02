import { Queue } from "bullmq";
import { ulid } from "ulid";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const TEST_AI_QUEUE_NAME = "test-ai-generation";

export interface TestAIJobData {
  tenantId: string;
  questionBankId: string;
  pdfKey: string;
  /** Number of questions requested */
  count: number;
  /** Allowed question types */
  types: Array<"MCQ_SINGLE" | "MCQ_MULTI" | "TRUE_FALSE" | "FIB" | "NAT">;
  difficultyMix: { easy: number; medium: number; hard: number };
  language: "en" | "hi";
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  createdBy?: string | null;
}

export interface TestAIJobProgress {
  status: "pending" | "extracting" | "generating" | "saving" | "completed" | "failed";
  pageCount?: number;
  chunksTotal?: number;
  chunksDone?: number;
  questionsGenerated?: number;
  questionsSaved?: number;
  error?: string;
}

export const testAIQueue = new Queue<TestAIJobData>(TEST_AI_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1, // expensive ops; failures handled in worker
    removeOnComplete: { age: 1800 }, // 30 min, frontend polls during this window
    removeOnFail: { age: 86400 }, // 24h for debugging
  },
});

/**
 * Submit a test-AI job. Returns a unique jobId. Multiple concurrent jobs per
 * tenant ARE allowed (unlike course-ai), since each PDF upload is a fresh
 * generation request.
 */
export async function submitTestAIJob(data: TestAIJobData): Promise<string> {
  const jobId = `test-ai-${data.tenantId}-${ulid()}`;
  await testAIQueue.add("generate-test-questions", data, { jobId });
  return jobId;
}
