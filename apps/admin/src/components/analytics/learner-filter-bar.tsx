"use client";

import { Button, Input } from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { X } from "lucide-react";

import type { LearnerFilters } from "@/lib/api/analytics";
import { useBundles } from "@/lib/hooks/use-bundles";
import { useCourses } from "@/lib/hooks/use-courses";
import { useTenantStore } from "@/lib/stores/tenant-store";

import { MultiSelectDropdown, type MultiSelectOption } from "./multi-select-dropdown";

const ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED", "SUSPENDED"];

type Option = MultiSelectOption;

export function LearnerFilterBar({
  value,
  onChange,
}: {
  value: LearnerFilters;
  onChange: (next: LearnerFilters) => void;
}) {
  const tenantId = useTenantStore((s) => s.selectedTenantId) ?? undefined;
  const { data: coursesData } = useCourses(tenantId, 1, 200);
  const { data: bundlesData } = useBundles(1, 200);

  const courseOptions: Option[] = (coursesData?.courses ?? []).map((c) => ({
    id: c.id,
    label: decodeHtmlEntities(c.title ?? ""),
  }));
  const bundleOptions: Option[] = (bundlesData?.bundles ?? []).map((b) => ({
    id: b.id,
    label: decodeHtmlEntities(b.title ?? ""),
  }));

  const set = (patch: Partial<LearnerFilters>) => onChange({ ...value, ...patch });
  const hasAny =
    !!value.courseIds?.length ||
    !!value.bundleIds?.length ||
    value.minAmount != null ||
    value.maxAmount != null ||
    !!value.enrollmentStatus?.length ||
    !!value.signupFrom ||
    !!value.signupTo;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <MultiSelectDropdown
        label="Courses"
        options={courseOptions}
        selected={value.courseIds ?? []}
        onChange={(ids) => set({ courseIds: ids })}
      />
      <MultiSelectDropdown
        label="Bundles"
        options={bundleOptions}
        selected={value.bundleIds ?? []}
        onChange={(ids) => set({ bundleIds: ids })}
      />

      {/* Amount range + scope */}
      <div className="flex items-end gap-1.5">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Amount (₹)</span>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Min"
              value={value.minAmount ?? ""}
              onChange={(e) =>
                set({ minAmount: e.target.value === "" ? undefined : Number(e.target.value) })
              }
              className="h-9 w-20"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Max"
              value={value.maxAmount ?? ""}
              onChange={(e) =>
                set({ maxAmount: e.target.value === "" ? undefined : Number(e.target.value) })
              }
              className="h-9 w-20"
            />
          </div>
        </div>
        <select
          value={value.amountScope ?? "total"}
          onChange={(e) => set({ amountScope: e.target.value as "total" | "selected" })}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          title="What the amount applies to"
        >
          <option value="total">Total spend</option>
          <option value="selected">Selected course/bundle</option>
        </select>
      </div>

      {/* Enrollment status */}
      <select
        value={value.enrollmentStatus?.[0] ?? ""}
        onChange={(e) =>
          set({ enrollmentStatus: e.target.value ? [e.target.value] : undefined })
        }
        className="h-9 rounded-md border bg-background px-2 text-sm"
        title="Enrollment status"
      >
        <option value="">Any status</option>
        {ENROLLMENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </select>

      {/* Signup date range */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Signed up</span>
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={value.signupFrom ?? ""}
            onChange={(e) => set({ signupFrom: e.target.value || undefined })}
            className="h-9 w-36"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            value={value.signupTo ?? ""}
            onChange={(e) => set({ signupTo: e.target.value || undefined })}
            className="h-9 w-36"
          />
        </div>
      </div>

      {hasAny && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={() => onChange({})}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
