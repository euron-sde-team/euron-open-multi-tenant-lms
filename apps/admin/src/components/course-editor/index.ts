// Course Editor Components
export { CourseEditorToolbar } from "./CourseEditorToolbar";
export { CourseEditorContainer } from "./CourseEditorContainer";
export { CourseThemePanel } from "./CourseThemePanel";
// TemplateSelector removed: course pages use Modern template only

// Inline editing components
export * from "./inline";

// Modal components
export * from "./modals";

// Course detail pages use the Modern template only.
export {
  ModernTemplate,
  courseTemplateConfigs as courseTemplates,
} from "@open-mtlms/course-templates";
