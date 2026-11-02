"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@open-mtlms/core";
import {
  getCountryName,
  getCurrencySymbol,
  getPlatformCurrency,
  REST_OF_WORLD,
  type TenantCurrencyConfig,
} from "@open-mtlms/shared";
import { Coins, MoreVertical, Star, Trash2 } from "lucide-react";

import type { CurrencyRegistryEntry } from "@/lib/api/currency-settings";

import { CountryMappingEditor } from "./CountryMappingEditor";

interface CurrencyListProps {
  currencies: TenantCurrencyConfig[];
  registry: CurrencyRegistryEntry[];
  onSetDefault: (code: string) => void;
  onRemove: (code: string) => void;
  onCountriesChange: (code: string, countries: string[]) => void;
  disabled?: boolean;
}

const MAX_VISIBLE_CHIPS = 8;

export function CurrencyList({
  currencies,
  registry,
  onSetDefault,
  onRemove,
  onCountriesChange,
  disabled = false,
}: CurrencyListProps) {
  const sorted = [...currencies].sort((a, b) => a.sort_order - b.sort_order);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-muted-foreground text-center">
            <Coins className="mx-auto mb-4 h-12 w-12" />
            <p>No currencies enabled yet.</p>
            <p className="mt-1 text-sm">Add a currency to start selling in it.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // country code -> owning currency, used to block double-mapping
  const ownerByCountry: Record<string, string> = {};
  let restOfWorldOwner: string | null = null;
  for (const c of sorted) {
    for (const country of c.countries) {
      if (country === REST_OF_WORLD) {
        restOfWorldOwner = c.currency;
      } else {
        ownerByCountry[country] = c.currency;
      }
    }
  }

  return (
    <div className="space-y-3">
      {sorted.map((row) => {
        const registryEntry = registry.find((r) => r.code === row.currency);
        const platform = getPlatformCurrency(row.currency);
        const name = registryEntry?.name ?? platform?.name ?? row.currency;
        const symbol = registryEntry?.symbol ?? getCurrencySymbol(row.currency);
        const razorpay = registryEntry ? registryEntry.razorpaySupported : true;
        const stripe = registryEntry ? registryEntry.stripeSupported : true;
        const visibleCountries = row.countries.slice(0, MAX_VISIBLE_CHIPS);
        const hiddenCount = row.countries.length - visibleCountries.length;
        const takenByOthers = Object.fromEntries(
          Object.entries(ownerByCountry).filter(([, owner]) => owner !== row.currency)
        );

        return (
          <Card key={row.currency}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold">
                    {symbol}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{row.currency}</span>
                      <span className="text-muted-foreground truncate text-sm">{name}</span>
                      {row.is_default && (
                        <Badge variant="outline">
                          <Star className="mr-1 h-3 w-3 fill-current" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {razorpay && (
                        <Badge variant="secondary" className="text-[10px]">
                          Razorpay
                        </Badge>
                      )}
                      {stripe && (
                        <Badge variant="secondary" className="text-[10px]">
                          Stripe
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <CountryMappingEditor
                    currencyCode={row.currency}
                    selectedCountries={row.countries}
                    onChange={(countries) => onCountriesChange(row.currency, countries)}
                    takenCountries={takenByOthers}
                    restOfWorldOwner={restOfWorldOwner}
                    isDefault={row.is_default}
                    disabled={disabled}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={disabled}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!row.is_default && (
                        <DropdownMenuItem onClick={() => onSetDefault(row.currency)}>
                          <Star className="mr-2 h-4 w-4" />
                          Set as default
                        </DropdownMenuItem>
                      )}
                      {!row.is_default && <DropdownMenuSeparator />}
                      {row.is_default ? (
                        <DropdownMenuItem disabled>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove (pick a new default first)
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => onRemove(row.currency)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {row.countries.length === 0 ? (
                  <span className="text-muted-foreground text-xs">
                    {row.is_default
                      ? "Fallback for all unmapped countries"
                      : "No countries mapped yet"}
                  </span>
                ) : (
                  <>
                    {visibleCountries.map((code) => (
                      <Badge key={code} variant="outline" className="text-[10px] font-normal">
                        {code === REST_OF_WORLD ? "Rest of world" : getCountryName(code)}
                      </Badge>
                    ))}
                    {hiddenCount > 0 && (
                      <span className="text-muted-foreground text-xs">
                        +{hiddenCount} more
                      </span>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
