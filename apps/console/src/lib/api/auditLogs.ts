import apiClient from './client';
import {
  ApiResponse,
  AuditLogEntry,
  AuditLogFilters,
  AuditLogListResponse,
} from './types';

/**
 * List admin audit log entries (filters + pagination).
 */
export const listAuditLogs = async (
  filters?: AuditLogFilters,
): Promise<AuditLogListResponse> => {
  const response = await apiClient.get<ApiResponse<AuditLogListResponse>>(
    '/admin/audit-logs',
    { params: filters },
  );
  return response.data.data;
};

/**
 * Get a single audit log entry by id.
 */
export const getAuditLog = async (id: string): Promise<AuditLogEntry> => {
  const response = await apiClient.get<ApiResponse<AuditLogEntry>>(
    `/admin/audit-logs/${id}`,
  );
  return response.data.data;
};
