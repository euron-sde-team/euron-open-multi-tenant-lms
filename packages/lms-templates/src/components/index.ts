// Video Players
export { YouTubePlayer } from "./VideoPlayer/YouTubePlayer";
export { VideoPlayer } from "./VideoPlayer/VideoPlayer";
// Needed by the public course page, which plays free samples for logged-out
// visitors and therefore has to pick the player by provider itself.
export { HlsPlayer } from "./VideoPlayer/hls/HlsPlayer";
export { VideoProcessingOverlay } from "./VideoPlayer/VideoProcessingOverlay";

// Assignment
export {
  AssignmentContent,
  type AssignmentData,
  type AssignmentSubmissionInfo,
} from "./AssignmentContent/AssignmentContent";

// Quiz
export {
  QuizContent,
  type QuizData,
  type QuizQuestion,
  type QuizQuestionType,
  type QuizOption,
  type QuizAttempt,
} from "./QuizContent/QuizContent";
export {
  DragDropQuestion,
  type DragDropOptionItem,
} from "./QuizContent/DragDropQuestion";

// Content Lesson (standalone PDF/LINK/TEXT/IMAGE lessons rendered in main area)
export {
  ContentLessonView,
  type ContentLessonBody,
} from "./ContentLesson/ContentLessonView";
export {
  ContentLessonSkeleton,
  CONTENT_FRAME,
} from "./ContentLesson/ContentLessonSkeleton";

// Resources
export { ResourceList } from "./Resources/ResourceList";
export { ResourceItem } from "./Resources/ResourceItem";
export { ResourceDownload } from "./Resources/ResourceDownload";
export { ResourceViewerDialog } from "./Resources/ResourceViewerDialog";

// Ratings
export { StarRating } from "./Rating/StarRating";
export { CourseRating } from "./Rating/CourseRating";
export { LessonRating } from "./Rating/LessonRating";

// Progress
export { ProgressBar } from "./Progress/ProgressBar";
export { MarkComplete } from "./Progress/MarkComplete";
export { LessonStatus } from "./Progress/LessonStatus";

// Navigation
export { CourseSidebar } from "./Navigation/CourseSidebar";
export { LessonList } from "./Navigation/LessonList";
export { SectionAccordion } from "./Navigation/SectionAccordion";
export { NextPrevButtons } from "./Navigation/NextPrevButtons";

// Overview
export { LessonOverview } from "./Overview/LessonOverview";
export { CourseOverview } from "./Overview/CourseOverview";
export { LessonTabs } from "./Overview/LessonTabs";
