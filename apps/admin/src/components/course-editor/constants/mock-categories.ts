/**
 * Shared mock categories for course editor.
 * In production this would come from an API.
 */

export interface MockCategory {
  id: string;
  name: string;
  icon?: string;
}

export const MOCK_CATEGORIES: MockCategory[] = [
  { id: "cat-1", name: "Web Development", icon: "🌐" },
  { id: "cat-2", name: "Mobile App", icon: "📱" },
  { id: "cat-3", name: "Data Science", icon: "📊" },
  { id: "cat-4", name: "Machine Learning", icon: "🤖" },
  { id: "cat-5", name: "Cloud Computing", icon: "☁️" },
  { id: "cat-6", name: "DevOps", icon: "🔧" },
  { id: "cat-7", name: "Cybersecurity", icon: "🔒" },
  { id: "cat-8", name: "UI/UX Design", icon: "🎨" },
  { id: "cat-9", name: "Programming Languages", icon: "💻" },
  { id: "cat-10", name: "Database", icon: "🗄️" },
];

/** By-id lookup for quick access */
export const MOCK_CATEGORIES_BY_ID: Record<string, MockCategory> = MOCK_CATEGORIES.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<string, MockCategory>
);
