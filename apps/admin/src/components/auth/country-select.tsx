"use client";

import { Input, Popover, PopoverContent, PopoverTrigger } from "@open-mtlms/core";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Country } from "react-phone-number-input";
import { getCountryCallingCode } from "react-phone-number-input";

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

export function CountrySelect({ value, onChange, options, disabled }: CountrySelectProps) {
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
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="border-input hover:bg-muted flex h-full items-center gap-1 border-r px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-base leading-none">{flag}</span>
          <span className="text-muted-foreground text-xs">{dialCode}</span>
          <ChevronDown className="text-muted-foreground h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-w-none p-2" align="start">
        <div className="relative mb-2">
          <Search className="text-muted-foreground absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
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
                "hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
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
                <span className="text-muted-foreground shrink-0 text-xs">
                  +{getCountryCallingCode(opt.value)}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">No countries found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
