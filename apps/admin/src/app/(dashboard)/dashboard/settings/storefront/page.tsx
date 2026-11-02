"use client";

import { Card, CardContent, Switch, useToast } from "@open-mtlms/core";
import { ArrowUpDown, Loader2, ShieldCheck } from "lucide-react";

import {
  useOrderedProductsSettings,
  useUpdateOrderedProductsSettings,
} from "@/lib/hooks/use-ordered-products";
import {
  useStorefrontSettings,
  useUpdateStorefrontSettings,
} from "@/lib/hooks/use-storefront-settings";

export default function StorefrontSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useStorefrontSettings();
  const updateSettings = useUpdateStorefrontSettings();
  const { data: orderedProducts } = useOrderedProductsSettings();
  const updateOrderedProducts = useUpdateOrderedProductsSettings();

  const orderedProductsOn = orderedProducts?.enabled ?? false;

  const handleOrderedProductsToggle = (enabled: boolean) => {
    updateOrderedProducts.mutate(enabled, {
      onSuccess: () => {
        toast({
          title: enabled ? "Ordered products enabled" : "Ordered products disabled",
          description: enabled
            ? "Drag handles are now on your course, book, bundle, batch and test series lists. The order you set is what learners see."
            : // The first worry on turning this off is "did I just lose my
              // arrangement?", answer it before they have to ask.
              "Your arrangement is saved. Lists go back to their default order, and turning this on again restores exactly what you set.",
        });
      },
      onError: (error) => {
        toast({
          title: "Could not update ordering",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const accessManaged = settings?.access_managed_enabled ?? false;

  const handleToggle = (enabled: boolean) => {
    updateSettings.mutate(
      { access_managed_enabled: enabled },
      {
        onSuccess: () => {
          toast({
            title: enabled ? "Access-managed storefront enabled" : "Access-managed storefront disabled",
            description: enabled
              ? "Prices are now hidden and self-serve purchase is blocked. Assign access from the Users area."
              : "Your storefront is back to normal: prices, cart, and checkout are visible again.",
          });
        },
        onError: (error) => {
          toast({
            title: "Could not update storefront settings",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Storefront</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Control how visitors can get access to your content.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Access-managed storefront</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    Hide all pricing and disable self-serve purchase and free enrollment
                    across your entire storefront. Visitors without access see a
                    &ldquo;Contact Support&rdquo; button (using your organisation&rsquo;s
                    support email); users you grant access to see &ldquo;Access Now&rdquo;
                    as usual. Access is assigned only by your team, from a member&rsquo;s
                    profile or via Bulk Enroll.
                  </p>
                </div>
              </div>
              <Switch
                checked={accessManaged}
                onCheckedChange={handleToggle}
                disabled={updateSettings.isPending}
                aria-label="Access-managed storefront"
              />
            </div>

          </CardContent>
        </Card>
      )}

      {!isLoading && (
        <Card className="mt-4">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                  <ArrowUpDown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Ordered products</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    Arrange your courses, books, bundles, batches and test series
                    in any order you like by dragging them, instead of them
                    being listed newest-first. Learners see exactly the order
                    you set. Courses are arranged separately for self-paced,
                    live and hybrid, since those are browsed on their own pages.
                  </p>
                </div>
              </div>
              <Switch
                checked={orderedProductsOn}
                onCheckedChange={handleOrderedProductsToggle}
                disabled={updateOrderedProducts.isPending}
                aria-label="Ordered products"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
