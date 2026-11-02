/**
 * Template category for the All Templates modal (4 categories only).
 * Used for filtering templates in the admin UI.
 */
export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  subCategories?: { id: string; name: string; description: string; icon: string }[];
}
