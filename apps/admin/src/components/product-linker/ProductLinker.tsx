"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  useToast,
} from "@open-mtlms/core";
import { Info, Loader2, Package } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  useLinkedProducts,
  useLinkableProducts,
  useSetLinkedProducts,
} from "@/lib/hooks/use-content-product-links";

type ContentType = "courses" | "books" | "bundles";

interface ProductLinkerProps {
  contentType: ContentType;
  contentId: string | undefined;
}

function formatWindow(window: string): string {
  switch (window) {
    case "MONTHLY":
      return "/mo";
    case "YEARLY":
      return "/yr";
    default:
      return "";
  }
}

function formatLimit(limitValue: number, isUnlimited: boolean, unit: string | null, window: string): string {
  if (isUnlimited) return `Unlimited${formatWindow(window)}`;
  return `${limitValue}${unit ? ` ${unit}` : ""}${formatWindow(window)}`;
}

export function ProductLinker({ contentType, contentId }: ProductLinkerProps) {
  const { toast } = useToast();
  const { data: linked, isLoading: linkedLoading } = useLinkedProducts(contentType, contentId);
  const { data: linkable, isLoading: linkableLoading } = useLinkableProducts(!!contentId);
  const setLinkedMutation = useSetLinkedProducts(contentType, contentId);

  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Sync selected codes from server data
  useEffect(() => {
    if (linked) {
      setSelectedCodes(new Set(linked.map((p) => p.product_code)));
      setHasChanges(false);
    }
  }, [linked]);

  const isLoading = linkedLoading || linkableLoading;

  // Merge linkable products with linked status
  const products = useMemo(() => {
    if (!linkable) return [];
    const linkedSet = new Set(linked?.map((p) => p.product_code) ?? []);
    return linkable.map((p) => ({
      ...p,
      isLinked: linkedSet.has(p.product_code),
    }));
  }, [linkable, linked]);

  const handleToggle = useCallback(
    (productCode: string, checked: boolean) => {
      setSelectedCodes((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(productCode);
        } else {
          next.delete(productCode);
        }
        return next;
      });
      setHasChanges(true);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!contentId) return;
    try {
      await setLinkedMutation.mutateAsync(Array.from(selectedCodes));
      setHasChanges(false);
      toast({ title: "Saved", description: "Linked products updated." });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update linked products.",
        variant: "destructive",
      });
    }
  }, [contentId, selectedCodes, setLinkedMutation, toast]);

  if (!contentId) return null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Linked Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Linked Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            No user-scoped products available on your plan.
          </div>
        </CardContent>
      </Card>
    );
  }

  const contentLabel = contentType === "courses" ? "course" : contentType === "books" ? "book" : "bundle";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Linked Products</CardTitle>
            <CardDescription className="text-xs">
              Give enrolled users access to these features
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={setLinkedMutation.isPending}
            >
              {setLinkedMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Save
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.map((product) => (
          <div
            key={product.product_code}
            className="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {product.product_title || product.product_code}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {product.feature_name || product.feature_key}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatLimit(
                      product.limit_value,
                      product.is_unlimited,
                      product.unit,
                      product.usage_window
                    )}{" "}
                    per user
                  </span>
                </div>
              </div>
            </div>
            <Switch
              checked={selectedCodes.has(product.product_code)}
              onCheckedChange={(checked) =>
                handleToggle(product.product_code, checked)
              }
            />
          </div>
        ))}
        {hasChanges && (
          <p className="text-xs text-muted-foreground">
            Users enrolled in this {contentLabel} will gain access to toggled-on products.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
