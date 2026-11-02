"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@open-mtlms/core";
import type { ContentPrice } from "@open-mtlms/shared";
import { useState, useEffect, useCallback } from "react";

import { MultiCurrencyPriceEditor } from "@/components/pricing/MultiCurrencyPriceEditor";
import type { BookStore } from "@/lib/stores/book-store";
import { legacyToPrices, pricesToLegacy } from "@/lib/utils/price-fields";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookStore: BookStore;
}

export function PricingModal({ isOpen, onClose, bookStore }: PricingModalProps) {
  const [purchaseMode, setPurchaseMode] = useState(bookStore.bookData.purchaseMode);
  const [prices, setPrices] = useState<ContentPrice[]>([]);
  const [validityDays, setValidityDays] = useState(
    (bookStore.bookData.validityDays ?? 365).toString()
  );
  const [lifetime, setLifetime] = useState(bookStore.bookData.validityDays === null);

  useEffect(() => {
    if (isOpen) {
      setPurchaseMode(bookStore.bookData.purchaseMode);
      // Use the multi-currency price book, fallback to legacy INR/USD fields
      setPrices(
        bookStore.bookData.prices?.length
          ? bookStore.bookData.prices
          : legacyToPrices(
              bookStore.bookData.priceInr || bookStore.bookData.webPriceINR || 0,
              bookStore.bookData.priceUsd || bookStore.bookData.webPriceUSD || 0,
              bookStore.bookData.discountInr || bookStore.bookData.webDiscount || 0,
              bookStore.bookData.discountUsd || 0
            )
      );
      setValidityDays((bookStore.bookData.validityDays ?? 365).toString());
      setLifetime(bookStore.bookData.validityDays === null);
    }
  }, [isOpen, bookStore.bookData]);

  const handlePricesChange = useCallback((next: ContentPrice[]) => {
    setPrices(next);
  }, []);

  const handleSave = () => {
    const v = parseInt(validityDays, 10);
    bookStore.updateSettings({
      purchaseMode,
      validityDays: lifetime ? null : Number.isNaN(v) || v < 1 ? 365 : v,
    });
    const legacy = pricesToLegacy(prices);
    bookStore.updatePricing({
      prices,
      priceInr: legacy.inr ?? 0,
      priceUsd: legacy.usd ?? 0,
      discountInr: legacy.discountInr ?? 0,
      discountUsd: legacy.discountUsd ?? 0,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book Pricing</DialogTitle>
          <DialogDescription>
            Set the pricing and purchase mode for your book.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
          {/* Validity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="lifetimeAccess">Lifetime access</Label>
                <p className="text-xs text-muted-foreground">
                  Learners keep access forever, with no expiry.
                </p>
              </div>
              <Switch id="lifetimeAccess" checked={lifetime} onCheckedChange={setLifetime} />
            </div>
            {!lifetime && (
              <>
                <Label htmlFor="validityDays">Access Validity (Days)</Label>
                <Input
                  id="validityDays"
                  type="number"
                  min="1"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  placeholder="365"
                />
                <p className="text-xs text-muted-foreground">
                  Access is valid for this many days after purchase. Default: 365.
                </p>
              </>
            )}
          </div>

          {/* Purchase Mode */}
          <div className="space-y-2">
            <Label>Purchase Mode</Label>
            <Select value={purchaseMode} onValueChange={(v) => setPurchaseMode(v as "FREE" | "PAID")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {purchaseMode === "PAID" && (
            <>
              {/* Multi-currency price book (one row per enabled currency) */}
              <MultiCurrencyPriceEditor
                value={prices}
                onChange={handlePricesChange}
                discountMode="percent"
              />

              <p className="text-muted-foreground text-xs">
                All prices should be inclusive of applicable taxes. No additional taxes will be charged to the buyer.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
