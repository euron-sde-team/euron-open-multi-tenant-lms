"use client";

import { useMemo, useState } from "react";
import type { Country } from "react-phone-number-input";
import { getCountryCallingCode } from "react-phone-number-input";
import { Popover, PopoverContent, PopoverTrigger, Input } from "@open-mtlms/core";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function getFlag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

interface CountryOption {
  value: Country | undefined;
  label: string;
}

interface CountrySelectProps {
  value: Country | undefined;
  onChange: (value: Country | undefined) => void;
  options: CountryOption[];
  disabled?: boolean;
  readOnly?: boolean;
  tabIndex?: number;
  className?: string;
}

export function CountrySelect({
  value,
  onChange,
  options,
  disabled,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.value && getCountryCallingCode(opt.value).includes(q))
    );
  }, [options, search]);

  const dialCode = value ? `+${getCountryCallingCode(value)}` : "";
  const flag = value ? getFlag(value) : "🌍";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-full items-center gap-1 border-r border-input px-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-base leading-none">{flag}</span>
          <span className="text-xs text-muted-foreground">{dialCode}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-w-none p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt.value ?? "__intl__"}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted",
                value === opt.value && "bg-primary/10 font-medium"
              )}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                setSearch("");
              }}
            >
              <span className="text-base leading-none">
                {opt.value ? getFlag(opt.value) : "🌍"}
              </span>
              <span className="flex-1 truncate text-left">{opt.label}</span>
              {opt.value && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  +{getCountryCallingCode(opt.value)}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No countries found
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
