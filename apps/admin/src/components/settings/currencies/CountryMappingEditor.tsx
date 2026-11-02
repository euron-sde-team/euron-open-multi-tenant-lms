"use client";

import {
  Button,
  cn,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@open-mtlms/core";
import { COUNTRIES, getCountryName, REST_OF_WORLD } from "@open-mtlms/shared";
import { Check, Globe2, Search } from "lucide-react";
import { useMemo, useState } from "react";

interface CountryMappingEditorProps {
  /** Currency this mapping belongs to. */
  currencyCode: string;
  /** Currently selected country codes (may include "*"). */
  selectedCountries: string[];
  onChange: (countries: string[]) => void;
  /** country code -> currency code, for countries owned by OTHER currencies. */
  takenCountries: Record<string, string>;
  /** Currency that currently owns the "*" rest-of-world marker, if any. */
  restOfWorldOwner: string | null;
  /** The default currency needs no countries (rest-of-world fallback). */
  isDefault: boolean;
  disabled?: boolean;
}

export function CountryMappingEditor({
  currencyCode,
  selectedCountries,
  onChange,
  takenCountries,
  restOfWorldOwner,
  isDefault,
  disabled = false,
}: CountryMappingEditorProps) {
  const [search, setSearch] = useState("");

  const selected = useMemo(() => new Set(selectedCountries), [selectedCountries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const toggle = (code: string) => {
    if (selected.has(code)) {
      onChange(selectedCountries.filter((c) => c !== code));
    } else {
      onChange([...selectedCountries, code]);
    }
  };

  const hasRestOfWorld = selected.has(REST_OF_WORLD);
  const restOfWorldTakenBy =
    restOfWorldOwner && restOfWorldOwner !== currencyCode ? restOfWorldOwner : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-7 gap-1.5 text-xs">
          <Globe2 className="h-3.5 w-3.5" />
          Edit countries
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 max-w-none p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        {isDefault && (
          <p className="text-muted-foreground border-b px-3 py-2 text-xs">
            {currencyCode} is the default currency. It already covers every country
            without an explicit mapping, so listing countries here is optional.
          </p>
        )}
        <div className="max-h-64 overflow-y-auto p-1">
          {/* Rest-of-world marker row */}
          <button
            type="button"
            disabled={!!restOfWorldTakenBy}
            onClick={() => toggle(REST_OF_WORLD)}
            className={cn(
              "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              restOfWorldTakenBy && "cursor-not-allowed opacity-50 hover:bg-transparent"
            )}
          >
            <span
              className={cn(
                "border-muted-foreground/40 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                hasRestOfWorld && "bg-primary border-primary text-primary-foreground"
              )}
            >
              {hasRestOfWorld && <Check className="h-3 w-3" />}
            </span>
            <span className="flex-1">Rest of world</span>
            {restOfWorldTakenBy ? (
              <span className="text-muted-foreground text-xs">{restOfWorldTakenBy}</span>
            ) : (
              <span className="text-muted-foreground text-xs">*</span>
            )}
          </button>

          {filtered.map((country) => {
            const isSelected = selected.has(country.code);
            const takenBy = takenCountries[country.code];
            const isTaken = !!takenBy && !isSelected;
            return (
              <button
                key={country.code}
                type="button"
                disabled={isTaken}
                onClick={() => toggle(country.code)}
                className={cn(
                  "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  isTaken && "cursor-not-allowed opacity-50 hover:bg-transparent"
                )}
                title={isTaken ? `Already mapped to ${takenBy}` : undefined}
              >
                <span
                  className={cn(
                    "border-muted-foreground/40 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isSelected && "bg-primary border-primary text-primary-foreground"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 truncate">{getCountryName(country.code)}</span>
                <span className="text-muted-foreground text-xs">
                  {isTaken ? takenBy : country.code}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-muted-foreground px-2 py-4 text-center text-sm">
              No countries match your search.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
