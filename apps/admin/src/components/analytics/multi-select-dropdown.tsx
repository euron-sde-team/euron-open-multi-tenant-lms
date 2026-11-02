"use client";

import { Input, cn } from "@open-mtlms/core";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

export interface MultiSelectOption {
  id: string;
  label: string;
}

/** Compact searchable multi-select dropdown (no extra deps). */
export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  width = "w-64",
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors hover:bg-muted",
          selected.length > 0 && "border-primary text-primary",
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 text-xs font-medium">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn("absolute left-0 top-full z-50 mt-1 rounded-md border bg-popover p-2 shadow-md", width)}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="mb-2 h-8"
            />
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No results</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        selected.includes(o.id) && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {selected.includes(o.id) && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
