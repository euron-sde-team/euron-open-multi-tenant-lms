import { lesson_resource_type } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import * as courseLmsRepo from "../repositories/course-lms.repository";
import * as lessonResourcesRepo from "../repositories/lesson-resources.repository";
import coursesRepository from "../repositories/courses.repository";

const RESOURCE_TYPES = Object.values(lesson_resource_type);

/** Types that point at an external/uploaded asset and therefore need a url. */
const URL_REQUIRED_TYPES: lesson_resource_type[] = [
  "PDF",
  "LINK",
  "IMAGE",
  "GITHUB",
];

function validateResourceType(value: string): lesson_resource_type {
  if (!RESOURCE_TYPES.includes(value as lesson_resource_type)) {
    throw new BadRequestError(
      `type must be one of: ${RESOURCE_TYPES.join(", ")}`
    );
  }
  return value as lesson_resource_type;
}

class LessonResourcesService {
  /**
   * Ensure course belongs to tenant and lesson belongs to that course;
   * throw if not found or wrong tenant (mirrors quiz endpoint ownership checks).
   */
  private async ensureLessonInCourse(
    tenantId: string,
    courseId: string,
    lessonId: string
  ): Promise<void> {
    const course = await coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundError("Course not found");
    }
    if (course.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this course");
    }
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson || lesson.course_id !== courseId) {
      throw new NotFoundError("Lesson not found");
    }
  }

  private async findOwnedResource(
    tenantId: string,
    lessonId: string,
    resourceId: string
  ): Promise<lessonResourcesRepo.LessonResourceRow> {
    const resource = await lessonResourcesRepo.findResourceById(
      resourceId,
      tenantId
    );
    if (!resource || resource.lesson_id !== lessonId) {
      throw new NotFoundError("Resource not found");
    }
    return resource;
  }

  async listResources(tenantId: string, courseId: string, lessonId: string) {
    await this.ensureLessonInCourse(tenantId, courseId, lessonId);
    return lessonResourcesRepo.findResourcesByLessonId(tenantId, lessonId);
  }

  async createResource(
    tenantId: string,
    courseId: string,
    lessonId: string,
    data: {
      type: string;
      title?: string;
      url?: string | null;
      content?: string | null;
      downloadable?: boolean;
      sort_order?: number;
    }
  ) {
    await this.ensureLessonInCourse(tenantId, courseId, lessonId);

    const type = validateResourceType(data.type);
    const title = (data.title ?? "").trim();
    if (!title) {
      throw new BadRequestError("title is required");
    }

    const url = typeof data.url === "string" ? data.url.trim() : null;
    const content = typeof data.content === "string" ? data.content.trim() : null;

    if (URL_REQUIRED_TYPES.includes(type) && !url) {
      throw new BadRequestError(`url is required for ${type} resources`);
    }
    if (type === "TEXT" && !content) {
      throw new BadRequestError("content is required for TEXT resources");
    }
    if (
      data.sort_order !== undefined &&
      (!Number.isInteger(data.sort_order) || data.sort_order < 0)
    ) {
      throw new BadRequestError("sort_order must be a non-negative integer");
    }

    return lessonResourcesRepo.createLessonResource({
      tenant_id: tenantId,
      course_id: courseId,
      lesson_id: lessonId,
      type,
      title,
      url: url || null,
      content: content || null,
      downloadable: data.downloadable === true,
      sort_order: data.sort_order,
    });
  }

  async updateResource(
    tenantId: string,
    courseId: string,
    lessonId: string,
    resourceId: string,
    data: {
      title?: string;
      url?: string | null;
      content?: string | null;
      downloadable?: boolean;
      sort_order?: number;
    }
  ) {
    await this.ensureLessonInCourse(tenantId, courseId, lessonId);
    const resource = await this.findOwnedResource(tenantId, lessonId, resourceId);

    const update: lessonResourcesRepo.UpdateLessonResourceInput = {};

    if (data.title !== undefined) {
      const title = String(data.title).trim();
      if (!title) throw new BadRequestError("title cannot be empty");
      update.title = title;
    }
    if (data.url !== undefined) {
      const url = typeof data.url === "string" ? data.url.trim() : null;
      if (URL_REQUIRED_TYPES.includes(resource.type) && !url) {
        throw new BadRequestError(
          `url cannot be cleared for ${resource.type} resources`
        );
      }
      update.url = url || null;
    }
    if (data.content !== undefined) {
      const content =
        typeof data.content === "string" ? data.content.trim() : null;
      if (resource.type === "TEXT" && !content) {
        throw new BadRequestError("content cannot be cleared for TEXT resources");
      }
      update.content = content || null;
    }
    if (data.downloadable !== undefined) {
      update.downloadable = data.downloadable === true;
    }
    if (data.sort_order !== undefined) {
      if (!Number.isInteger(data.sort_order) || data.sort_order < 0) {
        throw new BadRequestError("sort_order must be a non-negative integer");
      }
      update.sort_order = data.sort_order;
    }

    if (Object.keys(update).length === 0) {
      throw new BadRequestError("No fields provided to update");
    }

    const updated = await lessonResourcesRepo.updateLessonResource(
      resourceId,
      tenantId,
      update
    );
    if (!updated) throw new NotFoundError("Resource not found");
    return updated;
  }

  async deleteResource(
    tenantId: string,
    courseId: string,
    lessonId: string,
    resourceId: string
  ) {
    await this.ensureLessonInCourse(tenantId, courseId, lessonId);
    await this.findOwnedResource(tenantId, lessonId, resourceId);
    const ok = await lessonResourcesRepo.deleteLessonResource(
      resourceId,
      tenantId
    );
    if (!ok) throw new NotFoundError("Resource not found");
  }
}

const lessonResourcesService = new LessonResourcesService();
export default lessonResourcesService;
