"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button, Input, SkeletonCards, PartOfBundleBadge } from "@open-mtlms/core";
import { FileText, Layers, Play, Search, TrendingUp } from "lucide-react";
import type { ThemeConfig, TenantLayout } from "@open-mtlms/shared";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useTestSeriesCatalog } from "@/lib/hooks/use-test-series";
import { useCurrencyContext } from "@/lib/hooks/use-currency";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { resolveTestSeriesPrice } from "@/lib/utils/test-series-price";
import { getTestSeriesCoverUrl } from "@/lib/api/test-series";

interface CatalogClientProps {
  theme?: ThemeConfig;
  layout?: TenantLayout | null;
}

export function CatalogClient({ theme, layout }: CatalogClientProps) {
  const testSeriesTerm = useContentTerm("testSeries");
  const [search, setSearch] = useState("");
  const [pricing, setPricing] = useState<string>("");

  const { data, isLoading, error } = useTestSeriesCatalog();

  const filtered = useMemo(() => {
    const series = data ?? [];
    return series.filter((s) => {
      if (pricing && s.pricingType !== pricing) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, pricing]);

  return (
    <LayoutWrapper layout={layout ?? null} theme={theme}>
      <TenantThemeProvider theme={theme}>
        <div className="bg-background min-h-screen">
          <div className="container mx-auto max-w-6xl px-4 py-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-foreground text-3xl font-bold tracking-tight">
                  {testSeriesTerm.plural}
                </h1>
                <p className="text-muted-foreground mt-1">
                  Practice with full-length tests under real exam conditions.
                </p>
              </div>
              <Link href="/test-series/performance">
                <Button variant="outline" size="sm">
                  <TrendingUp className="mr-1.5 h-4 w-4" />
                  My Performance
                </Button>
              </Link>
            </div>

            <div className="mb-6 flex flex-wrap gap-3">
              <div className="relative max-w-md flex-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder={`Search ${testSeriesTerm.plural.toLowerCase()}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {(["", "FREE", "PAID"] as const).map((p) => (
                  <Button
                    key={p || "all"}
                    variant={pricing === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPricing(p)}
                  >
                    {p === "" ? "All" : p === "FREE" ? "Free" : "Paid"}
                  </Button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <SkeletonCards count={6} />
            ) : error ? (
              <Card>
                <CardContent className="py-12 text-center text-sm">
                  Failed to load {testSeriesTerm.plural.toLowerCase()}.
                </CardContent>
              </Card>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Layers className="text-muted-foreground mb-3 h-10 w-10" />
                  <p className="text-muted-foreground">
                    {search || pricing
                      ? `No matching ${testSeriesTerm.plural.toLowerCase()}`
                      : `No ${testSeriesTerm.plural.toLowerCase()} available yet`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((s) => (
                  <Link key={s.id} href={`/test-series/${s.slug}`}>
                    <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                      <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden">
                        {s.coverImageKey ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getTestSeriesCoverUrl(s.coverImageKey) ?? ""}
                            alt={s.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <FileText className="text-muted-foreground/50 h-10 w-10" />
                          </div>
                        )}
                        {/* Non-linking: this whole card is already a <Link>,
                            and nesting an <a> inside one is invalid HTML. */}
                        {s.bundles && s.bundles.length > 0 && (
                          <div className="absolute bottom-2 left-2 right-2">
                            <PartOfBundleBadge bundles={s.bundles} asLink={false} />
                          </div>
                        )}
                      </div>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="line-clamp-2 text-base">
                            {s.title}
                          </CardTitle>
                          <CatalogStatusBadge series={s} />
                        </div>
                        <CardDescription className="line-clamp-2">
                          {s.description ?? ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-muted-foreground flex items-center gap-3 text-xs">
                          <span>{s.totalTests} tests</span>
                          {s.category && (
                            <>
                              <span>•</span>
                              <span>{s.category}</span>
                            </>
                          )}
                          {/* null validityDays = lifetime, not "no validity". */}
                          <span>•</span>
                          <span>
                            {s.validityDays == null
                              ? "Lifetime access"
                              : `${s.validityDays}d access`}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </TenantThemeProvider>
    </LayoutWrapper>
  );
}

interface CatalogStatusBadgeProps {
  series: {
    pricingType: "FREE" | "PAID";
    priceInr: string | null;
    priceUsd: string | null;
    discountInr: string | null;
    discountUsd: string | null;
    hasAccess: boolean;
  };
}

function CatalogStatusBadge({ series }: CatalogStatusBadgeProps) {
  const { resolvedCurrency, defaultCurrency, enabledCurrencies, isLoaded } = useCurrencyContext();
  const { accessManaged } = useStorefrontConfig();
  // Owned wins over every pricing branch below, including "Free" and the
  // access-managed blank: once a learner has the series, what they need is the
  // way in, not what it costs. Mirrors CourseCard swapping its price slot for
  // "Continue Learning".
  if (series.hasAccess) {
    return (
      <Badge variant="success" className="shrink-0 gap-1">
        <Play className="h-3 w-3" />
        Attempt now
      </Badge>
    );
  }
  // Access-managed storefront: no price (or "Free") text on catalog cards.
  if (accessManaged) {
    return null;
  }
  if (series.pricingType === "FREE") {
    return <Badge variant="secondary">Free</Badge>;
  }
  if (!isLoaded) {
    return <span className="bg-muted inline-block h-5 w-12 animate-pulse rounded" />;
  }
  const price = resolveTestSeriesPrice(series, {
    resolvedCurrency,
    defaultCurrency,
    enabledCurrencies,
  });
  if (!price) return <Badge variant="default">Paid</Badge>;
  if (!price.hasDiscount) {
    return (
      <Badge variant="default">
        {price.symbol}
        {price.format(price.effective)}
      </Badge>
    );
  }
  return (
    <div className="flex flex-col items-end">
      <Badge variant="default">
        {price.symbol}
        {price.format(price.effective)}
      </Badge>
      <span className="text-muted-foreground mt-0.5 text-xs line-through">
        {price.symbol}
        {price.format(price.original)}
      </span>
    </div>
  );
}
