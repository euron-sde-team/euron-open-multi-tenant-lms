"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  useToast,
} from "@open-mtlms/core";
import { decodeHtmlEntities, getCurrencySymbol, type TenantCurrencyConfig } from "@open-mtlms/shared";
import { AlertTriangle, Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AddCurrencyModal, CurrencyList } from "@/components/settings/currencies";
import type { CurrencySettingsResponse } from "@/lib/api/currency-settings";
import {
  useCurrencyCoverage,
  useCurrencySettings,
  useUpdateCurrencySettings,
} from "@/lib/hooks/use-currency-settings";

function toDraft(settings: CurrencySettingsResponse): TenantCurrencyConfig[] {
  return [...settings.currencies]
    .filter((c) => c.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c, index) => ({
      currency: c.currency,
      is_default: c.is_default,
      countries: c.countries,
      sort_order: index,
    }));
}

function normalize(currencies: TenantCurrencyConfig[]): string {
  return JSON.stringify(
    [...currencies]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        currency: c.currency,
        is_default: c.is_default,
        countries: [...c.countries].sort(),
      }))
  );
}

function formatEntityType(entityType: string): string {
  return entityType.replace(/_/g, " ").toLowerCase();
}

export default function CurrenciesSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading, error, refetch } = useCurrencySettings();
  const { data: coverage } = useCurrencyCoverage();
  const updateMutation = useUpdateCurrencySettings();

  const [draft, setDraft] = useState<TenantCurrencyConfig[] | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [removalConfirmation, setRemovalConfirmation] = useState<{
    removal_impact: Record<string, number>;
    message: string;
  } | null>(null);

  // Initialize draft once settings load (and re-sync after saves via key compare)
  useEffect(() => {
    if (settings && draft === null) {
      setDraft(toDraft(settings));
    }
  }, [settings, draft]);

  const serverNormalized = useMemo(
    () => (settings ? normalize(toDraft(settings)) : null),
    [settings]
  );
  const isDirty = draft !== null && serverNormalized !== null && normalize(draft) !== serverNormalized;

  const handleAddCurrency = useCallback((code: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.some((c) => c.currency === code)) return prev;
      return [
        ...prev,
        {
          currency: code,
          is_default: prev.length === 0,
          countries: [],
          sort_order: prev.length,
        },
      ];
    });
  }, []);

  const handleSetDefault = useCallback((code: string) => {
    setDraft((prev) =>
      prev
        ? prev.map((c) => ({ ...c, is_default: c.currency === code }))
        : prev
    );
  }, []);

  const handleRemove = useCallback((code: string) => {
    setDraft((prev) =>
      prev
        ? prev
            .filter((c) => c.currency !== code)
            .map((c, index) => ({ ...c, sort_order: index }))
        : prev
    );
  }, []);

  const handleCountriesChange = useCallback((code: string, countries: string[]) => {
    setDraft((prev) =>
      prev
        ? prev.map((c) => (c.currency === code ? { ...c, countries } : c))
        : prev
    );
  }, []);

  const submit = useCallback(
    (confirmRemoval: boolean) => {
      if (!draft) return;
      updateMutation.mutate(
        {
          currencies: draft.map((c) => ({
            currency: c.currency,
            is_default: c.is_default,
            countries: c.countries,
          })),
          ...(confirmRemoval ? { confirm_removal: true } : {}),
        },
        {
          onSuccess: (result) => {
            if (!result.applied) {
              setRemovalConfirmation({
                removal_impact: result.removal_impact,
                message: result.message,
              });
              return;
            }
            setRemovalConfirmation(null);
            setDraft(toDraft(result.settings));
            toast({
              title: "Currency settings saved",
              description:
                result.deleted_price_rows > 0
                  ? `${result.deleted_price_rows} saved price${result.deleted_price_rows === 1 ? "" : "s"} for removed currencies were deleted.`
                  : undefined,
            });
          },
          onError: (err) => {
            toast({
              title: "Failed to save",
              description:
                err instanceof Error ? err.message : "Could not save currency settings.",
              variant: "destructive",
            });
          },
        }
      );
    },
    [draft, updateMutation, toast]
  );

  const handleSave = useCallback(() => submit(false), [submit]);
  const handleConfirmRemoval = useCallback(() => submit(true), [submit]);

  const enabledCodes = useMemo(
    () => (draft ?? []).map((c) => c.currency),
    [draft]
  );

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Currencies</h1>
          <p className="text-muted-foreground">
            Choose the currencies you sell in and map countries to each one.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAddModalOpen(true)} disabled={!draft}>
            <Plus className="mr-2 h-4 w-4" />
            Add Currency
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Gateway warnings */}
      {settings && settings.gateway_warnings.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              {settings.gateway_warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Coverage warnings: PAID items missing a default-currency price */}
      {coverage && coverage.total_missing > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1.5">
              <p className="font-medium">
                {coverage.total_missing} paid item{coverage.total_missing === 1 ? "" : "s"}{" "}
                {coverage.total_missing === 1 ? "has" : "have"} no{" "}
                {coverage.default_currency} ({getCurrencySymbol(coverage.default_currency)})
                price. Buyers without a matching currency cannot purchase them.
              </p>
              {coverage.targets
                .filter((t) => t.missing_count > 0)
                .map((target) => (
                  <p key={target.entity_type}>
                    {target.missing_count} {formatEntityType(target.entity_type)} need a{" "}
                    {coverage.default_currency} price
                    {target.sample.length > 0 && (
                      <span className="text-amber-700 dark:text-amber-300">
                        {" "}
                        (e.g.{" "}
                        {target.sample
                          .slice(0, 3)
                          .map((s) => decodeHtmlEntities(s.title))
                          .join(", ")}
                        )
                      </span>
                    )}
                  </p>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Unsaved defaults note */}
      {settings?.is_virtual && (
        <div className="text-muted-foreground mb-4 rounded-md border p-3 text-sm">
          You are using the standard INR + USD setup. Save once to customize your
          currency list and country mapping.
        </div>
      )}

      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin" />
              <span className="text-muted-foreground ml-2">Loading currencies...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && error && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-destructive">Failed to load currency settings</p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && draft && settings && (
        <CurrencyList
          currencies={draft}
          registry={settings.registry}
          onSetDefault={handleSetDefault}
          onRemove={handleRemove}
          onCountriesChange={handleCountriesChange}
          disabled={updateMutation.isPending}
        />
      )}

      <AddCurrencyModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        registry={settings?.registry ?? []}
        enabledCodes={enabledCodes}
        onAdd={handleAddCurrency}
      />

      <AlertDialog
        open={!!removalConfirmation}
        onOpenChange={(open) => !open && setRemovalConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove currencies with saved prices?</AlertDialogTitle>
            <AlertDialogDescription>
              {removalConfirmation?.message}
              <span className="mt-3 block space-y-1">
                {Object.entries(removalConfirmation?.removal_impact ?? {}).map(
                  ([currency, count]) => (
                    <span key={currency} className="block">
                      <span className="font-medium">{currency}</span>: {count} saved price
                      {count === 1 ? "" : "s"} will be deleted
                    </span>
                  )
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoval}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updateMutation.isPending ? "Removing..." : "Remove and Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
