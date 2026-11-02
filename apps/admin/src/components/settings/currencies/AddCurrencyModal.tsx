"use client";

import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@open-mtlms/core";
import { useMemo, useState } from "react";

import type { CurrencyRegistryEntry } from "@/lib/api/currency-settings";

interface AddCurrencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registry: CurrencyRegistryEntry[];
  /** Codes already enabled for the tenant (excluded from the picker). */
  enabledCodes: string[];
  onAdd: (code: string) => void;
}

export function AddCurrencyModal({
  open,
  onOpenChange,
  registry,
  enabledCodes,
  onAdd,
}: AddCurrencyModalProps) {
  const [search, setSearch] = useState("");

  const available = useMemo(() => {
    const enabled = new Set(enabledCodes.map((c) => c.toUpperCase()));
    const q = search.trim().toLowerCase();
    return registry
      .filter((r) => !enabled.has(r.code.toUpperCase()))
      .filter(
        (r) =>
          !q ||
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.symbol.toLowerCase().includes(q)
      );
  }, [registry, enabledCodes, search]);

  const handleSelect = (code: string) => {
    onAdd(code);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Currency</DialogTitle>
          <DialogDescription>
            Pick a currency to sell in. You can map countries to it after adding.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code, name, or symbol..."
          autoFocus
        />

        <div className="-mx-1 max-h-72 overflow-y-auto px-1">
          {available.map((entry) => (
            <button
              key={entry.code}
              type="button"
              onClick={() => handleSelect(entry.code)}
              className="hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors"
            >
              <span className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                {entry.symbol}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{entry.code}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {entry.name}
                </span>
              </span>
              <span className="flex max-w-[55%] shrink-0 flex-wrap items-center justify-end gap-1">
                {entry.razorpaySupported && (
                  <Badge variant="secondary" className="text-[10px]">
                    Razorpay
                  </Badge>
                )}
                {entry.stripeSupported && (
                  <Badge variant="secondary" className="text-[10px]">
                    Stripe
                  </Badge>
                )}
              </span>
            </button>
          ))}
          {available.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {search.trim()
                ? "No currencies match your search."
                : "All supported currencies are already enabled."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
