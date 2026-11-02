/**
 * Global Activity Feed Types
 * Unified activity stream across all tenants from application events, addon events, and usage events
 */

import { PaginationParams, PaginatedResponse } from "./tenant.type";

export type ActivityKind = "application" | "addon" | "usage";

export interface ActivityFeedEntry {
  id: string;
  kind: ActivityKind;
  tenant_id: string;
  tenant_name: string;
  event_type: string;
  description: string;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  admin_id: string | null;
  is_system: boolean;
  created_at: Date;
}

export type ActivityFeedListResponse = PaginatedResponse<ActivityFeedEntry>;

export interface ActivityFeedQueryParams extends PaginationParams {
  kind?: ActivityKind;
  search?: string;
}
