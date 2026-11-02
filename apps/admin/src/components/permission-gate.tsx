"use client";

import { useHasAnyPermission, useHasPermission } from "@/lib/hooks/use-permissions";

interface Props {
  children: React.ReactNode;
  requires?: string;
  requiresAny?: string[];
  fallback?: React.ReactNode;
}

export function PermissionGate({
  children,
  requires,
  requiresAny,
  fallback = null,
}: Props) {
  const hasSingle = useHasPermission(requires ?? "");
  const hasAny = useHasAnyPermission(...(requiresAny ?? []));

  const allowed =
    (!requires && !requiresAny) ||
    (requires && hasSingle) ||
    (requiresAny && requiresAny.length > 0 && hasAny);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
