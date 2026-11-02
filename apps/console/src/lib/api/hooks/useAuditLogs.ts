import { useQuery } from 'react-query';

import { getAuditLog, listAuditLogs } from '../auditLogs';
import { AuditLogEntry, AuditLogFilters, AuditLogListResponse } from '../types';

export type { AuditLogFilters } from '../types';

/**
 * List admin audit log entries (DB-backed admin action trail).
 */
export const useAuditLogs = (filters?: AuditLogFilters) => {
  return useQuery<AuditLogListResponse, Error>({
    queryKey: ['audit-logs', filters],
    queryFn: () => listAuditLogs(filters),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};

/**
 * Get a single audit log entry by id.
 */
export const useAuditLog = (id: string | undefined) => {
  return useQuery<AuditLogEntry, Error>({
    queryKey: ['audit-logs', id],
    queryFn: () => getAuditLog(id as string),
    enabled: !!id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};
