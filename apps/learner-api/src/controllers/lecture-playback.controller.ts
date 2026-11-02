import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import lecturePlaybackService from "../services/lecture-playback.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * POST /courses/:courseId/lectures/:lectureId/playback
 * Auth required. No body: the video comes from the lecture row after the
 * enrollment check.
 */
export const getLecturePlayback = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  const data = await lecturePlaybackService.forLecture({
    tenantId,
    memberId,
    courseId: String(req.params.courseId ?? ""),
    lectureId: String(req.params.lectureId ?? ""),
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Playback ready",
  });
};
