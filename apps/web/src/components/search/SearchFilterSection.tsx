"use client";

import { useState } from "react";
import { cn } from "@open-mtlms/core";
import { ChevronDown, Check } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterSectionProps {
  title: string;
  options: FilterOption[];
  selected: string | string[] | undefined;
  onChange: (value: string | string[] | undefined) => void;
  multiSelect?: boolean;
  defaultOpen?: boolean;
}

export function SearchFilterSection({
  title,
  options,
  selected,
  onChange,
  multiSelect = false,
  defaultOpen = true,
}: SearchFilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (options.length === 0) return null;

  const selectedArr = Array.isArray(selected)
    ? selected
    : selected
      ? [selected]
      : [];

  const selectedCount = selectedArr.length;

  function handleSingleSelect(value: string) {
    onChange(selected === value ? undefined : value);
  }

  function handleMultiSelect(value: string) {
    const current = new Set(selectedArr);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    const arr = Array.from(current);
    onChange(arr.length > 0 ? arr : undefined);
  }

  return (
    <div className="border-b border-border/50 pb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2.5 text-sm font-semibold transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          {title}
          {selectedCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {selectedCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-1 space-y-0.5 pb-1">
            {options.map((opt) => {
              const isSelected = selectedArr.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    isSelected
                      ? "bg-primary/8 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <input
                    type={multiSelect ? "checkbox" : "radio"}
                    checked={isSelected}
                    onChange={() =>
                      multiSelect
                        ? handleMultiSelect(opt.value)
                        : handleSingleSelect(opt.value)
                    }
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center border transition-all duration-150",
                      multiSelect ? "rounded" : "rounded-full",
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                    )}
                  >
                    {isSelected && (
                      multiSelect ? (
                        <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                      )
                    )}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
