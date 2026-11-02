/**
 * Curriculum authoring: whole jobs, not endpoint fragments.
 *
 * WHY THIS SERVICE EXISTS
 * -----------------------
 * The LMS routes are shaped for an editor screen that already knows the whole
 * tree: reordering demands the complete sibling list, moving a lesson demands
 * TWO complete sibling lists, and building a module means one call for the
 * module and one per lesson. A person with the editor open has all of that on
 * screen. An assistant does not, and reconstructing it call by call is where
 * plans get long, expensive and wrong: send one id short and the platform
 * answers 409 STALE_CURRICULUM, correctly, halfway through a plan.
 *
 * So the loop lives here. "Add a Networking module with four lessons" is one
 * call. "Move Kubernetes to the end" is one call that names ONE thing and a
 * position, and this works out the sibling lists the routes want.
 *
 * THE TWO STORES, WHICH IS THE WHOLE POINT
 * ----------------------------------------
 * A course keeps its curriculum TWICE:
 *
 *   `course_sections` / `course_lessons`   what enrolled learners study
 *   `tenant_pages.sections`                the outline a VISITOR reads on the
 *   (the `course-curriculum` section)      public course page
 *
 * They are separate records, both hand-authored, and nothing reconciles them.
 * Every write below touches the FIRST one, because that is the course. The
 * public page keeps showing whatever outline was written for it until
 * `publishOutlineToPage` copies the real curriculum across, which is why
 * `getOutline` reports the divergence rather than leaving a caller to assume
 * one write covered both. Reporting "done" after writing only the LMS tables
 * would be true about the database and false about the thing the admin asked
 * for.
 */
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import courseLmsRepo from "../repositories/course-lms.repository";
import coursesRepository from "../repositories/courses.repository";
import curriculumRepo from "../repositories/curriculum-authoring.repository";
import pagesRepository from "../repositories/pages.repository";
import courseLmsService from "./course-lms.service";

/* ------------------------------------------------------------------ */
/*  Shapes returned to callers                                         */
/* ------------------------------------------------------------------ */

export type LessonType =
  | "LECTURE"
  | "QUIZ"
  | "ASSIGNMENT"
  | "PDF"
  | "LINK"
  | "TEXT"
  | "IMAGE";

const LESSON_TYPES: LessonType[] = [
  "LECTURE",
  "QUIZ",
  "ASSIGNMENT",
  "PDF",
  "LINK",
  "TEXT",
  "IMAGE",
];

export interface OutlineLesson {
  lessonId: string;
  title: string;
  type: string;
  position: number;
  freePreview: boolean;
  /** Present for a lecture; this is what a video is attached to. */
  lectureId?: string;
  duration?: string;
  hasVideo: boolean;
  quiz?: { quizId: string; title: string; status: string };
  assignment?: { assignmentId: string; title: string; status: string };
  attachments?: Array<{ resourceId: string; title: string; type: string }>;
}

export interface OutlineModule {
  moduleId: string;
  title: string;
  position: number;
  lessons: OutlineLesson[];
}

export interface CurriculumOutline {
  courseTitle: string;
  courseStatus: string;
  modules: OutlineModule[];
  totals: { modules: number; lessons: number; videos: number };
  landingPage: {
    pageId: string | null;
    /** How many lessons the PUBLIC page currently advertises. */
    lessonsShown: number;
    matchesCurriculum: boolean;
    note: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function loadCourse(tenantId: string, courseId: string) {
  const course = await coursesRepository.findById(courseId);
  if (!course) throw new NotFoundError("Course not found");
  if (course.tenant_id !== tenantId) {
    throw new ForbiddenError("You do not have access to this course");
  }
  return course;
}

interface PageSection {
  id: string;
  type: string;
  order: number;
  content: Record<string, unknown>;
  [key: string]: unknown;
}

function sectionsOf(page: { sections?: unknown } | undefined): PageSection[] {
  const raw = page?.sections;
  return Array.isArray(raw) ? (raw as PageSection[]) : [];
}

/** The rows of a `course-curriculum` section's content, across its nested shape. */
function lecturesIn(
  content: Record<string, unknown> | null | undefined
): Array<Record<string, unknown>> {
  const groups = content?.sections;
  if (!Array.isArray(groups)) return [];
  const rows: Array<Record<string, unknown>> = [];
  for (const group of groups as Array<Record<string, unknown>>) {
    const modules = Array.isArray(group.modules) ? group.modules : [];
    for (const mod of modules as Array<Record<string, unknown>>) {
      if (Array.isArray(mod.lectures)) rows.push(...(mod.lectures as Array<Record<string, unknown>>));
    }
    // Older pages keep lectures directly on the group.
    if (modules.length === 0 && Array.isArray(group.lectures)) {
      rows.push(...(group.lectures as Array<Record<string, unknown>>));
    }
  }
  return rows;
}

/** Lessons the public page currently advertises, across its nested shape. */
function lessonsShownOnPage(sections: PageSection[]): number {
  const curriculum = sections.find((s) => s.type === "course-curriculum");
  return curriculum ? lecturesIn(curriculum.content).length : 0;
}

/**
 * Preview videos attached to the page's syllabus rows, by the lesson each one
 * belongs to once the outline is rebuilt.
 *
 * They are attached in the landing editor and live only on the page, so rows
 * rebuilt from the curriculum have none, and writing those rows would delete
 * every one. A row published from the curriculum carries its lesson id, so the
 * id is the match. An outline written by hand shares no ids with it, so on
 * that first publish a title naming exactly one lesson on each side stands in.
 * Titles are never used once an id is shared: a lesson deleted and remade under
 * the same name must not inherit a preview whose video went with the old one.
 * The landing editor's syllabus sync keeps them by the same rule.
 */
function previewVideosToKeep(
  previousContent: Record<string, unknown> | null,
  lessons: OutlineLesson[]
): Map<string, unknown> {
  const keep = new Map<string, unknown>();
  const rows = lecturesIn(previousContent);
  if (!rows.some((row) => row.previewVideo)) return keep;

  const lessonIds = new Set(lessons.map((l) => l.lessonId));
  const idOf = (row: Record<string, unknown>) =>
    typeof row.id === "string" && lessonIds.has(row.id) ? row.id : undefined;
  if (rows.some((row) => idOf(row))) {
    for (const row of rows) {
      const id = idOf(row);
      if (id && row.previewVideo) keep.set(id, row.previewVideo);
    }
    return keep;
  }

  const titleOf = (title: unknown) =>
    typeof title === "string" ? title.trim().toLowerCase() : "";
  const countTitles = (titles: string[]) => {
    const counts = new Map<string, number>();
    for (const t of titles) counts.set(t, (counts.get(t) ?? 0) + 1);
    return counts;
  };
  const titlesBefore = countTitles(rows.map((row) => titleOf(row.title)));
  const titlesAfter = countTitles(lessons.map((l) => titleOf(l.title)));
  const byTitle = new Map<string, unknown>();
  for (const row of rows) {
    const title = titleOf(row.title);
    if (row.previewVideo && title && titlesBefore.get(title) === 1 && titlesAfter.get(title) === 1) {
      byTitle.set(title, row.previewVideo);
    }
  }
  for (const lesson of lessons) {
    const previewVideo = byTitle.get(titleOf(lesson.title));
    if (previewVideo) keep.set(lesson.lessonId, previewVideo);
  }
  return keep;
}

/** 1-based position clamped into a list of `length` items. */
function clampPosition(position: number | undefined, length: number): number {
  if (position === undefined || !Number.isFinite(position)) return length;
  return Math.min(Math.max(Math.trunc(position), 1), Math.max(length, 1)) - 1;
}

/* ------------------------------------------------------------------ */

class CurriculumAuthoringService {
  /* ---- read ----------------------------------------------------- */

  /**
   * The whole curriculum in one call, lean enough to put in a prompt.
   *
   * Two queries and no loop, and deliberately not the full rows: video keys,
   * HLS keys and lecture summaries are not what anyone reasoning about
   * structure needs, and they are what makes the existing full-tree route
   * expensive to read.
   */
  async getOutline(tenantId: string, courseId: string): Promise<CurriculumOutline> {
    const course = await loadCourse(tenantId, courseId);

    const [rows, resources] = await Promise.all([
      curriculumRepo.findCurriculumRows(tenantId, courseId),
      curriculumRepo.findCourseLessonResources(tenantId, courseId),
    ]);

    const attachmentsByLesson = new Map<
      string,
      Array<{ resourceId: string; title: string; type: string }>
    >();
    for (const r of resources) {
      const list = attachmentsByLesson.get(r.lesson_id) ?? [];
      list.push({ resourceId: r.id, title: r.title, type: r.type });
      attachmentsByLesson.set(r.lesson_id, list);
    }

    const modules: OutlineModule[] = [];
    const byId = new Map<string, OutlineModule>();
    let lessons = 0;
    let videos = 0;

    for (const row of rows) {
      let mod = byId.get(row.section_id);
      if (!mod) {
        mod = {
          moduleId: row.section_id,
          title: row.section_title,
          position: modules.length + 1,
          lessons: [],
        };
        byId.set(row.section_id, mod);
        modules.push(mod);
      }
      if (!row.lesson_id) continue;

      const hasVideo = !!row.lecture_video_key;
      if (hasVideo) videos += 1;
      lessons += 1;

      mod.lessons.push({
        lessonId: row.lesson_id,
        title: row.lesson_title ?? "",
        type: row.lesson_type ?? "LECTURE",
        position: mod.lessons.length + 1,
        freePreview: Boolean(row.lesson_is_preview),
        ...(row.lecture_id ? { lectureId: row.lecture_id } : {}),
        ...(row.lecture_duration ? { duration: row.lecture_duration } : {}),
        hasVideo,
        ...(row.quiz_id
          ? {
              quiz: {
                quizId: row.quiz_id,
                title: row.quiz_title ?? "",
                status: String(row.quiz_status ?? ""),
              },
            }
          : {}),
        ...(row.assignment_id
          ? {
              assignment: {
                assignmentId: row.assignment_id,
                title: row.assignment_title ?? "",
                status: String(row.assignment_status ?? ""),
              },
            }
          : {}),
        ...(attachmentsByLesson.has(row.lesson_id)
          ? { attachments: attachmentsByLesson.get(row.lesson_id) }
          : {}),
      });
    }

    const page = await pagesRepository.findByTenantAndSlug(
      tenantId,
      `courses/${course.slug}`
    );
    const shown = lessonsShownOnPage(sectionsOf(page));

    return {
      courseTitle: course.title,
      courseStatus: String(course.status),
      modules,
      totals: { modules: modules.length, lessons, videos },
      landingPage: {
        pageId: page?.id ?? null,
        lessonsShown: shown,
        matchesCurriculum: shown === lessons,
        note:
          shown === lessons
            ? "The public course page advertises the same number of lessons as the course contains."
            : `The public course page advertises ${shown} lesson(s) while the course contains ${lessons}. ` +
              "The page keeps its own copy of the outline; publish the curriculum to the page to make them agree.",
      },
    };
  }

  /* ---- add ------------------------------------------------------- */

  /**
   * Add a module with its lessons, or add lessons to a module that exists.
   *
   * One call because that is one job. Creating a module and then a lesson at a
   * time is four round trips for a four-lesson module, each one a step in a
   * plan that can fail halfway and leave a half-built module behind.
   */
  async addToCurriculum(
    tenantId: string,
    courseId: string,
    input: {
      moduleId?: string;
      moduleTitle?: string;
      position?: number;
      lessons?: Array<{ title: string; type?: LessonType }>;
    }
  ) {
    const course = await loadCourse(tenantId, courseId);
    const lessons = input.lessons ?? [];

    for (const lesson of lessons) {
      if (!lesson?.title || !lesson.title.trim()) {
        throw new BadRequestError("Every lesson needs a title.");
      }
      if (lesson.type && !LESSON_TYPES.includes(lesson.type)) {
        throw new BadRequestError(
          `"${lesson.type}" is not a lesson type. Use one of: ${LESSON_TYPES.join(", ")}.`
        );
      }
    }

    let moduleId = input.moduleId;
    let moduleTitle = input.moduleTitle?.trim() ?? "";
    let createdModule = false;

    if (moduleId) {
      const existing = await courseLmsRepo.findSectionById(moduleId, tenantId);
      if (!existing || existing.course_id !== courseId) {
        throw new NotFoundError("That module is not part of this course.");
      }
      moduleTitle = existing.title;
      if (lessons.length === 0) {
        throw new BadRequestError(
          "Adding to an existing module needs at least one lesson. To rename it, edit the module instead."
        );
      }
    } else {
      if (!moduleTitle) {
        throw new BadRequestError(
          "Give the new module a title, or name an existing module to add lessons to."
        );
      }
      const siblings = await courseLmsRepo.findSectionsByCourseId(tenantId, courseId);
      const sortOrder =
        input.position === undefined
          ? siblings.length
          : clampPosition(input.position, siblings.length + 1);
      const created = await courseLmsService.createSection(tenantId, courseId, {
        title: moduleTitle,
        sort_order: sortOrder,
      });
      moduleId = created.id;
      createdModule = true;

      // Inserting in the middle means everything after it has to move down.
      if (input.position !== undefined && sortOrder < siblings.length) {
        const order = siblings.map((s) => s.id);
        order.splice(sortOrder, 0, created.id);
        await courseLmsService.reorderSections(tenantId, courseId, order);
      }
    }

    const existingLessons = await courseLmsRepo.findLessonsBySectionId(
      tenantId,
      moduleId!
    );
    let sortOrder = existingLessons.length;

    const added: Array<{
      lessonId: string;
      title: string;
      type: string;
      lectureId?: string;
    }> = [];

    for (const lesson of lessons) {
      const type: LessonType = lesson.type ?? "LECTURE";
      const row = await courseLmsService.createLesson(
        tenantId,
        courseId,
        moduleId!,
        { title: lesson.title.trim(), type, sort_order: sortOrder }
      );
      sortOrder += 1;

      // A lecture ROW is what a video attaches to. Creating the lesson without
      // it leaves nothing for the video tools to point at, and the admin is
      // told the lesson exists while there is nowhere to put the recording.
      let lectureId: string | undefined;
      if (type === "LECTURE") {
        const lecture = await courseLmsService.createLecture(
          tenantId,
          courseId,
          row.id,
          { title: lesson.title.trim() }
        );
        lectureId = (lecture as { id?: string })?.id;
      }

      added.push({
        lessonId: row.id,
        title: row.title,
        type: String(row.type),
        ...(lectureId ? { lectureId } : {}),
      });
    }

    return {
      courseTitle: course.title,
      moduleId: moduleId!,
      moduleTitle,
      moduleCreated: createdModule,
      lessons: added,
      note:
        "This is the curriculum enrolled learners study. The public course page keeps its own copy of the outline and still shows what it showed before.",
    };
  }

  /* ---- edit one item --------------------------------------------- */

  /**
   * Rename a module or a lesson, or change a lesson's free-preview flag.
   *
   * One tool for both because it is one job to a person: change this thing in
   * the curriculum. Two routes with near-identical bodies is an implementation
   * detail of the editor screen.
   */
  async updateItem(
    tenantId: string,
    courseId: string,
    itemId: string,
    input: { itemType: "MODULE" | "LESSON"; title?: string; freePreview?: boolean }
  ) {
    await loadCourse(tenantId, courseId);

    if (input.itemType === "MODULE") {
      const section = await courseLmsRepo.findSectionById(itemId, tenantId);
      if (!section || section.course_id !== courseId) {
        throw new NotFoundError("That module is not part of this course.");
      }
      if (input.freePreview !== undefined) {
        throw new BadRequestError(
          "Free preview is a lesson setting. Name the lesson rather than the module."
        );
      }
      if (!input.title?.trim()) {
        throw new BadRequestError("Give the module a new title.");
      }
      const updated = await courseLmsService.updateSection(itemId, tenantId, {
        title: input.title.trim(),
      });
      return {
        itemType: "MODULE" as const,
        moduleId: itemId,
        title: (updated as { title?: string })?.title ?? input.title.trim(),
        previousTitle: section.title,
        freePreview: undefined as boolean | undefined,
      };
    }

    const lesson = await courseLmsRepo.findLessonById(itemId, tenantId);
    if (!lesson || lesson.course_id !== courseId) {
      throw new NotFoundError("That lesson is not part of this course.");
    }
    if (input.title === undefined && input.freePreview === undefined) {
      throw new BadRequestError(
        "Nothing to change. Send a new title, a free-preview setting, or both."
      );
    }

    const updated = await courseLmsService.updateLesson(itemId, tenantId, {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.freePreview !== undefined ? { is_preview: input.freePreview } : {}),
    });

    return {
      itemType: "LESSON" as const,
      lessonId: itemId,
      title: (updated as { title?: string })?.title ?? lesson.title,
      previousTitle: lesson.title,
      freePreview:
        input.freePreview === undefined ? Boolean(lesson.is_preview) : input.freePreview,
      previousFreePreview: Boolean(lesson.is_preview),
    };
  }

  /* ---- arrange --------------------------------------------------- */

  /**
   * Move one module, or one lesson, to a position.
   *
   * The routes underneath want the complete new order of every sibling, and
   * refuse the request when the set does not match exactly. That is the right
   * contract for an editor holding the whole tree and the wrong one for a
   * caller who wants "put Kubernetes last": working the list out here is the
   * difference between a reliable tool and a 409 halfway through a plan.
   */
  async arrange(
    tenantId: string,
    courseId: string,
    input: {
      moduleId?: string;
      lessonId?: string;
      toModuleId?: string;
      toPosition?: number;
    }
  ) {
    await loadCourse(tenantId, courseId);

    if (!input.moduleId && !input.lessonId) {
      throw new BadRequestError(
        "Name the module or the lesson to move. Read the curriculum first to get its id."
      );
    }
    if (input.moduleId && input.lessonId) {
      throw new BadRequestError("Move one thing at a time: a module or a lesson.");
    }

    /* ---- a module moves among modules ---- */
    if (input.moduleId) {
      const siblings = await courseLmsRepo.findSectionsByCourseId(tenantId, courseId);
      const moving = siblings.find((s) => s.id === input.moduleId);
      if (!moving) {
        throw new NotFoundError("That module is not part of this course.");
      }
      const order = siblings.map((s) => s.id).filter((id) => id !== moving.id);
      order.splice(clampPosition(input.toPosition, order.length + 1), 0, moving.id);
      await courseLmsService.reorderSections(tenantId, courseId, order);
      return {
        moved: "MODULE" as const,
        title: moving.title,
        position: order.indexOf(moving.id) + 1,
        of: order.length,
      };
    }

    /* ---- a lesson moves within or between modules ---- */
    const lesson = await courseLmsRepo.findLessonById(input.lessonId!, tenantId);
    if (!lesson || lesson.course_id !== courseId) {
      throw new NotFoundError("That lesson is not part of this course.");
    }

    const sourceSectionId = lesson.section_id;
    const targetSectionId = input.toModuleId ?? sourceSectionId;

    if (targetSectionId !== sourceSectionId) {
      const target = await courseLmsRepo.findSectionById(targetSectionId, tenantId);
      if (!target || target.course_id !== courseId) {
        throw new NotFoundError("The module you are moving it into is not part of this course.");
      }
    }

    const sourceLessons = await courseLmsRepo.findLessonsBySectionId(
      tenantId,
      sourceSectionId
    );

    if (targetSectionId === sourceSectionId) {
      const order = sourceLessons.map((l) => l.id).filter((id) => id !== lesson.id);
      order.splice(clampPosition(input.toPosition, order.length + 1), 0, lesson.id);
      await courseLmsService.reorderLessonsInSection(
        tenantId,
        courseId,
        sourceSectionId,
        order
      );
      return {
        moved: "LESSON" as const,
        title: lesson.title,
        moduleId: sourceSectionId,
        position: order.indexOf(lesson.id) + 1,
        of: order.length,
      };
    }

    const targetLessons = await courseLmsRepo.findLessonsBySectionId(
      tenantId,
      targetSectionId
    );
    const sourceOrder = sourceLessons.map((l) => l.id).filter((id) => id !== lesson.id);
    const targetOrder = targetLessons.map((l) => l.id).filter((id) => id !== lesson.id);
    targetOrder.splice(
      clampPosition(input.toPosition, targetOrder.length + 1),
      0,
      lesson.id
    );

    await courseLmsService.moveLesson(tenantId, courseId, {
      lessonId: lesson.id,
      sourceSectionId,
      targetSectionId,
      sourceLessonIds: sourceOrder,
      targetLessonIds: targetOrder,
    });

    return {
      moved: "LESSON" as const,
      title: lesson.title,
      moduleId: targetSectionId,
      position: targetOrder.indexOf(lesson.id) + 1,
      of: targetOrder.length,
    };
  }

  /* ---- publish the outline to the public page -------------------- */

  /**
   * Make the public course page show the curriculum the course actually has.
   *
   * WHY THIS IS A SEPARATE, DELIBERATE ACT
   * -------------------------------------
   * The landing page's outline is written for marketing. It is frequently NOT
   * the LMS curriculum: shorter, differently worded, sometimes describing a
   * course still being recorded. Refreshing it automatically on every lesson
   * added would quietly delete that copy, so this is asked for by name, offers
   * a dry run, and hands back the previous content so it can be put straight
   * back.
   *
   * The shape written here is the one the storefront reads: each module becomes
   * a page section carrying a single group of lectures, and a lesson marked as
   * a free preview arrives as `isPreview`, which is what puts the preview badge
   * in front of a visitor. Writing the LMS flag alone never does. A preview
   * video attached in the landing editor stays on its lesson's row, see
   * `previewVideosToKeep`.
   */
  async publishOutlineToPage(
    tenantId: string,
    courseId: string,
    options: { dryRun?: boolean; restoreContent?: Record<string, unknown> } = {}
  ) {
    const course = await loadCourse(tenantId, courseId);
    const pageSlug = `courses/${course.slug}`;
    const page = await pagesRepository.findByTenantAndSlug(tenantId, pageSlug);
    if (!page) {
      throw new NotFoundError(
        "This course has no landing page, so there is no public outline to update."
      );
    }

    const sections = sectionsOf(page);
    const index = sections.findIndex((s) => s.type === "course-curriculum");
    const previousContent =
      index >= 0 ? (sections[index]!.content as Record<string, unknown>) : null;
    const lessonsBefore = lessonsShownOnPage(sections);

    let content: Record<string, unknown>;
    let lessonCount: number;
    let moduleCount: number;
    let previewCount = 0;

    if (options.restoreContent) {
      content = options.restoreContent;
      const restored = lessonsShownOnPage([
        { id: "x", type: "course-curriculum", order: 0, content },
      ]);
      lessonCount = restored;
      moduleCount = Array.isArray(content.sections)
        ? (content.sections as unknown[]).length
        : 0;
    } else {
      const outline = await this.getOutline(tenantId, courseId);
      const previewVideos = previewVideosToKeep(
        previousContent,
        outline.modules.flatMap((mod) => mod.lessons)
      );
      const groups = outline.modules.map((mod, i) => ({
        id: mod.moduleId,
        title: mod.title,
        order: i,
        modules: [
          {
            id: `${mod.moduleId}-lessons`,
            title: mod.title,
            order: 0,
            lectures: mod.lessons.map((lesson) => {
              const previewVideo = previewVideos.get(lesson.lessonId);
              const isPreview = lesson.freePreview || previewVideo !== undefined;
              if (isPreview) previewCount += 1;
              return {
                id: lesson.lessonId,
                title: lesson.title,
                duration: lesson.duration ?? "",
                isPreview,
                ...(previewVideo !== undefined ? { previewVideo } : {}),
              };
            }),
          },
        ],
      }));

      lessonCount = outline.totals.lessons;
      moduleCount = outline.totals.modules;
      content = {
        headline:
          (previousContent?.headline as string | undefined) ?? "Course Content",
        subheadline: (previousContent?.subheadline as string | undefined) ?? "",
        sections: groups,
        totalLectures: lessonCount,
      };
    }

    const result = {
      applied: false,
      dryRun: options.dryRun === true,
      courseTitle: course.title,
      pageId: page.id,
      pageSlug: page.slug,
      pagePublished: Boolean(page.is_published),
      lessonsShownBefore: lessonsBefore,
      lessonsShownAfter: lessonCount,
      modulesShown: moduleCount,
      freePreviewLessons: previewCount,
      previousContent,
      note: page.is_published
        ? "The course page is live, so visitors see this immediately."
        : "The course page is a draft, so nobody outside the workspace sees this yet.",
    };

    if (options.dryRun) return result;

    const next = [...sections];
    if (index >= 0) {
      next[index] = { ...next[index]!, content };
    } else {
      const order = next.reduce((m, s) => Math.max(m, Number(s.order) || 0), 0) + 1;
      next.push({
        id: `${course.id}-curriculum`,
        type: "course-curriculum",
        order,
        content,
        deleted: false,
        variant: "default",
        visible: true,
        settings: {},
      } as PageSection);
    }

    await pagesRepository.update(page.id, { sections: next as never }, undefined, tenantId);

    result.applied = true;
    return result;
  }
}

export default new CurriculumAuthoringService();
