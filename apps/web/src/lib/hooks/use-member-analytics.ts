import { useQuery } from "@tanstack/react-query";
import { memberAnalyticsApi } from "@/lib/api/member-analytics";

export function useMemberAnalytics(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["member-analytics"],
    queryFn: () => memberAnalyticsApi.getAnalytics(),
    staleTime: 5 * 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useMemberCertificates() {
  return useQuery({
    queryKey: ["member-certificates"],
    queryFn: () => memberAnalyticsApi.getCertificates(),
    staleTime: 5 * 60_000,
  });
}
