"use client";

import { Badge } from "@open-mtlms/core";

import { getDomainStatusInfo } from "@/lib/hooks";
import type { DomainStatus } from "@/lib/types";

interface DomainStatusBadgeProps {
  status: DomainStatus;
  showDescription?: boolean;
}

export function DomainStatusBadge({ status, showDescription = false }: DomainStatusBadgeProps) {
  const { label, color, description } = getDomainStatusInfo(status);

  return (
    <div className="flex flex-col gap-1">
      <Badge variant={color}>{label}</Badge>
      {showDescription && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </div>
  );
}
