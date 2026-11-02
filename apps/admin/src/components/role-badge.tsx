"use client";

import { useEffect, useState } from "react";

import { useAuthStore } from "@/lib/stores/auth-store";

export function RoleBadge() {
  const { roles, isOwner } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const label = isOwner ? "Owner" : roles[0] ?? null;
  if (!label) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground capitalize">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
      {label}
    </span>
  );
}
