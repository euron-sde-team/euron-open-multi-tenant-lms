import { Worker, type Job } from "bullmq";
import { PDFParse } from "pdf-parse";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { TEST_AI_QUEUE_NAME, type TestAIJobData, type TestAIJobProgress } from "./test-ai.queue";
import testAIService, { type GeneratedQuestion } from "../services/test-ai.service";
import testQuestionsRepository from "../repositories/test-questions.repository";
import { unmangleLatexDeep } from "../utils/latex-sanitizer";
import uploadService from "../services/upload.service";
import logger from "../utils/logger";

const MAX_PAGES = 1000;
const TARGET_TOKENS_PER_CHUNK = 2000;
const APPROX_CHARS_PER_TOKEN = 4;

let worker: Worker | null = null;

function chunkText(text: string): string[] {
  const targetSize = TARGET_TOKENS_PER_CHUNK * APPROX_CHARS_PER_TOKEN;
  if (text.length <= targetSize) return [text];

  // Split on paragraph boundaries first, then pack into chunks of ~targetSize
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length + 2 > targetSize && current.length > 0) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Distribute the requested count of questions across the chunks proportionally
 * to chunk size, ensuring every chunk gets at least 1 if count >= chunks.
 */
function allocateCounts(totalCount: number, chunks: string[]): number[] {
  const totalChars = chunks.reduce((s, c) => s + c.length, 0);
  if (totalChars === 0) return chunks.map(() => 0);

  const raw = chunks.map((c) => (c.length / totalChars) * totalCount);
  const floored = raw.map((r) => Math.max(0, Math.floor(r)));
  let assigned = floored.reduce((s, n) => s + n, 0);

  // Distribute remainder
  const remainders = raw
    .map((r, idx) => ({ idx, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (assigned < totalCount && i < remainders.length) {
    floored[remainders[i].idx] += 1;
    assigned += 1;
    i += 1;
  }

  // Ensure no chunk has 0 if we have enough total
  if (totalCount >= chunks.length) {
    for (let idx = 0; idx < floored.length; idx += 1) {
      if (floored[idx] === 0) {
        // Steal from the largest allocation
        const maxIdx = floored.indexOf(Math.max(...floored));
        if (maxIdx !== idx && floored[maxIdx] > 1) {
          floored[idx] = 1;
          floored[maxIdx] -= 1;
        }
      }
    }
  }
  return floored;
}

/**
 * Cheap deduplication: drop generated questions whose stem (lowercased,
 * collapsed whitespace, first 80 chars) is identical to one already kept.
 * Avoids LLM repetition across chunks without needing embeddings.
 */
function dedupeQuestions(items: GeneratedQuestion[]): GeneratedQuestion[] {
  const seen = new Set<string>();
  const out: GeneratedQuestion[] = [];
  for (const q of items) {
    const key = q.stem.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

async function processJob(job: Job<TestAIJobData>): Promise<void> {
  const { tenantId, questionBankId, pdfKey, count, types, difficultyMix, language, subject, chapter, topic, createdBy } = job.data;

  logger.info(
    `[test-ai-worker] Starting job ${job.id} for tenant ${tenantId}: bank=${questionBankId} count=${count}`
  );

  const updateProgress = async (p: TestAIJobProgress) => {
    await job.updateProgress(p as unknown as Record<string, unknown>);
  };

  await updateProgress({ status: "extracting" });

  // 1. Download PDF
  const { buffer } = await uploadService.getPdfBuffer(pdfKey);

  // 2. Parse PDF
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  let pageCount = 0;
  let text = "";
  try {
    const parsed = await parser.getText();
    pageCount = parsed.total;
    text = (parsed.text ?? "").trim();
  } finally {
    await parser.destroy().catch(() => undefined);
  }

  if (pageCount > MAX_PAGES) {
    throw new Error(`PDF has ${pageCount} pages; limit is ${MAX_PAGES}`);
  }
  if (text.length < 100) {
    throw new Error(
      "Could not extract enough text from this PDF. Scanned PDFs are not supported in V1 (OCR fallback is on the roadmap)."
    );
  }

  // 4. Chunk + allocate counts
  const chunks = chunkText(text);
  const counts = allocateCounts(count, chunks);

  await updateProgress({
    status: "generating",
    pageCount,
    chunksTotal: chunks.length,
    chunksDone: 0,
    questionsGenerated: 0,
  });

  // 5. Generate per chunk
  const generated: GeneratedQuestion[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const chunkCount = counts[i];
    if (chunkCount <= 0) continue;
    try {
      const items = await testAIService.generateQuestions(chunks[i], {
        count: chunkCount,
        types,
        difficultyMix,
        language,
        subject,
        chapter,
        topic,
      });
      generated.push(...items);
    } catch (err) {
      logger.error(
        `[test-ai-worker] Chunk ${i + 1}/${chunks.length} failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      // Continue with remaining chunks; partial output is still useful
    }
    await updateProgress({
      status: "generating",
      pageCount,
      chunksTotal: chunks.length,
      chunksDone: i + 1,
      questionsGenerated: generated.length,
    });
  }

  if (generated.length === 0) {
    throw new Error("Generation produced no valid questions. Try a different PDF.");
  }

  // 6. Dedupe + save as PUBLISHED (AI questions are ready-to-use)
  const deduped = dedupeQuestions(generated);

  await updateProgress({
    status: "saving",
    pageCount,
    chunksTotal: chunks.length,
    chunksDone: chunks.length,
    questionsGenerated: deduped.length,
    questionsSaved: 0,
  });

  const inputs = deduped.map((q) => ({
    tenant_id: tenantId,
    question_bank_id: questionBankId,
    type: q.type,
    // Repair JSON-escape damage on every text-bearing field. Cheap, idempotent,
    // and a no-op for clean strings.
    stem: unmangleLatexDeep(q.stem),
    options: unmangleLatexDeep(q.options ?? null),
    correct_answer: unmangleLatexDeep(q.correct_answer),
    explanation: unmangleLatexDeep(q.explanation),
    difficulty: q.difficulty,
    subject: q.suggested_subject ?? subject ?? null,
    chapter: q.suggested_chapter ?? chapter ?? null,
    topic: q.suggested_topic ?? topic ?? null,
    status: "PUBLISHED" as const,
    created_via: "AI" as const,
    ai_metadata: {
      jobId: job.id,
      pdfKey,
      confidence: q.confidence,
      generatedAt: new Date().toISOString(),
    },
    created_by: createdBy ?? null,
  }));

  const saved = await testQuestionsRepository.createMany(inputs);

  // 7. Best-effort: delete the source PDF from S3 (debugging trail kept in ai_metadata)
  // Skipped intentionally, keep the PDF for ~30 days for debugging; orphan cleanup
  // can be added later if storage cost matters.

  await updateProgress({
    status: "completed",
    pageCount,
    chunksTotal: chunks.length,
    chunksDone: chunks.length,
    questionsGenerated: deduped.length,
    questionsSaved: saved.length,
  });

  logger.info(
    `[test-ai-worker] Job ${job.id} completed: saved ${saved.length} questions for tenant ${tenantId}`
  );
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startTestAIWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(TEST_AI_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    logger.info(`[test-ai-worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `[test-ai-worker] Job ${job?.id ?? "unknown"} failed: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    logger.error("[test-ai-worker] Worker error:", err);
  });

  logger.info("[test-ai-worker] Started");
  return worker;
}

export async function stopTestAIWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[test-ai-worker] Stopped");
}
