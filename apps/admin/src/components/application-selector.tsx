"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-mtlms/core";
import { AppWindow } from "lucide-react";
import { useEffect, useState } from "react";

import { useApplicationStore } from "@/lib/stores/application-store";

export function ApplicationSelector() {
  const { applications, selectedApplicationCode, selectApplication } =
    useApplicationStore();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || applications.length === 0) {
    return null;
  }

  // Single application, show name only (no dropdown)
  if (applications.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm">
        <AppWindow className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{applications[0].name}</span>
      </div>
    );
  }

  // Multiple applications, dropdown selector
  return (
    <Select
      value={selectedApplicationCode || undefined}
      onValueChange={selectApplication}
    >
      <SelectTrigger className="w-[220px]">
        <div className="flex items-center gap-2">
          <AppWindow className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Select application" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {applications.map((app) => (
          <SelectItem key={app.code} value={app.code}>
            <span>{app.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
