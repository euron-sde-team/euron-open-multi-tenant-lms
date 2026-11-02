// Re-export shim, the registry now lives in @open-mtlms/lms-templates so backend
// services (tenant provisioning) can consume it. All existing import paths
// continue to resolve through this file unchanged.
export {
  pageTemplates,
  getTemplateById,
  getTemplatesByPageCategory,
  type PageTemplate,
} from "@open-mtlms/lms-templates";
