import { apiClient } from "./axios";

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  category: string;
  resource_type: string | null;
  resource_id: string | null;
  resource_label: string | null;
  /** The line a human reads: "Priya published the course 'Python Masterclass'". */
  summary: string;
  metadata: Record<string, unknown> | null;
  /** false = the action was blocked. */
  succeeded: boolean;
  ip_address: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  actorUserId?: string;
  /**
   * UI-only: which "Last N days" preset is selected. Never sent to the server.
   * it exists so the dropdown can show the chosen option, while `from` carries
   * the actual instant the server filters on.
   */
  days?: string;
  category?: string;
  action?: string;
  /** "false" to show only the blocked attempts. */
  succeeded?: boolean;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogPage {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditFilterOptions {
  /** Everyone who has ever appeared in this tenant's log. */
  actors: { id: string; name: string | null; email: string | null }[];
  categories: string[];
  actions: { action: string; category: string }[];
}

export const auditApi = {
  list: async (filters: AuditLogFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.actorUserId) params.actorUserId = filters.actorUserId;
    if (filters.category) params.category = filters.category;
    if (filters.action) params.action = filters.action;
    if (filters.succeeded !== undefined)
      params.succeeded = String(filters.succeeded);
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.search) params.search = filters.search;
    params.page = filters.page ?? 1;
    params.limit = filters.limit ?? 50;

    return (await apiClient.get("/tenant/audit-logs", { params })).data
      .data as AuditLogPage;
  },

  /**
   * The route guard turned this person away from a page. Best-effort: the
   * report must never break the "no access" screen it comes from.
   */
  reportDeniedView: async (path: string, label: string | null) => {
    try {
      await apiClient.post("/tenant/audit-logs/denied-view", { path, label });
    } catch {
      // Logging only. The person still sees the access screen either way.
    }
  },

  filterOptions: async () =>
    (await apiClient.get("/tenant/audit-logs/filters")).data
      .data as AuditFilterOptions,
};
