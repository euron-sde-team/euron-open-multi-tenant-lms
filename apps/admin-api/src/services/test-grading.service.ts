import axios from "axios";

import config from "../config";
import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import testGradingRepository from "../repositories/test-grading.repository";
import logger from "../utils/logger";

class TestGradingService {
  /** Evaluator queue: attempts with descriptive answers awaiting a manual grade. */
  async listPendingAttempts(
    tenantId: string,
    params: { testId?: string; seriesId?: string; page: number; limit: number }
  ) {
    return testGradingRepository.listPendingAttempts(tenantId, params);
  }

  /** One attempt's descriptive answers to grade (student answer + max marks). */
  async getAttemptForGrading(tenantId: string, attemptId: string) {
    const result = await testGradingRepository.getAttemptForGrading(
      tenantId,
      attemptId
    );
    if (!result) throw new NotFoundError("Attempt not found");
    return result;
  }

  /**
   * Grade a single descriptive answer (0..question.marks) and recompute the
   * attempt: score = sum of all awarded marks (auto + manual). When no
   * descriptive answers remain pending, grading_status flips to COMPLETED and
   * the learner sees the final score.
   */
  async gradeAnswer(
    tenantId: string,
    answerId: string,
    gradedBy: string | null,
    input: { marksAwarded: number; remarks: string | null }
  ) {
    const answer = await testGradingRepository.findAnswerWithQuestion(
      tenantId,
      answerId
    );
    if (!answer) throw new NotFoundError("Answer not found");
    if (String(answer.type) !== "DESCRIPTIVE") {
      throw new BadRequestError("Only descriptive answers are manually graded");
    }

    const maxMarks = Number(answer.marks ?? 0);
    const marks = input.marksAwarded;
    if (typeof marks !== "number" || Number.isNaN(marks)) {
      throw new BadRequestError("marksAwarded must be a number");
    }
    if (marks < 0 || marks > maxMarks) {
      throw new BadRequestError(`Marks must be between 0 and ${maxMarks}`);
    }
    const remarks =
      input.remarks && input.remarks.trim().length > 0
        ? input.remarks.trim().slice(0, 2000)
        : null;

    const attemptId = answer.attempt_id;
    let gradingStatus = "PENDING_REVIEW";
    let score = 0;

    await db.transaction().execute(async (trx) => {
      await testGradingRepository.gradeAnswer(
        tenantId,
        answerId,
        { marksAwarded: marks, gradedBy, remarks },
        trx
      );
      const attempt = await testGradingRepository.findAttempt(tenantId, attemptId);
      // Read the post-update state within the same transaction.
      const summary = await testGradingRepository.getAttemptGradingSummary(
        tenantId,
        attemptId,
        trx
      );
      const totalMarks = Number(attempt?.total_marks ?? 0);
      score = summary.awardedTotal;
      const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
      gradingStatus =
        summary.pendingCount === 0 ? "COMPLETED" : "PENDING_REVIEW";
      await testGradingRepository.updateAttemptScore(
        tenantId,
        attemptId,
        { score, percentage, gradingStatus },
        trx
      );
    });

    // The instant grading is fully done, ask learner-api to issue (and email) the
    // certificate on the FINAL score, so the learner gets it without reopening
    // their result. Fire-and-forget: learner-api is idempotent and also issues
    // lazily on result-read, so a failure here is never fatal.
    if (gradingStatus === "COMPLETED") {
      this.notifyAttemptGraded(tenantId, attemptId);
    }

    return { graded: true, attemptId, score, gradingStatus };
  }

  /** Best-effort ping to learner-api to issue rewards for a finished attempt. */
  private notifyAttemptGraded(tenantId: string, attemptId: string): void {
    const url = `${config.USER_SERVER_BASE_URL}/api/v1/internal/test-rewards/${attemptId}`;
    axios
      .post(
        url,
        { tenantId },
        {
          headers: { "x-internal-key": config.INTERNAL_API_KEY },
          timeout: 10000,
        }
      )
      .catch((err: unknown) => {
        logger.warn("[test-grading] reward notify failed", {
          attemptId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }
}

export default new TestGradingService();
