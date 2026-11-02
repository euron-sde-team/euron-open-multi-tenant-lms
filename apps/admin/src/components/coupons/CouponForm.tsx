"use client";

import {
  Button,
  Input,
  Label,
  Switch,
  useToast,
} from "@open-mtlms/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { Coupon, CreateCouponRequest, CreateCouponApplicableItemRequest } from "@/lib/api/coupons";
import { useCreateCoupon, useUpdateCoupon } from "@/lib/hooks/use-coupons";
import { cn } from "@/lib/utils";

import { ApplicableItemsSelector, type ApplicableItem } from "./ApplicableItemsSelector";

const couponSchema = z.object({
  code: z.string().min(1, "Code is required"),
  // New coupons are always PERCENTAGE, that is all this form authors. FIXED is
  // accepted so that editing a fixed-amount coupon (legacy rows, and the
  // test-series coupons folded in by the unification migration) preserves its
  // type instead of silently rewriting "₹100 off" as "100% off".
  discount_type: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
  discount_value: z.number({ coerce: true }).positive("Must be positive"),
  valid_from: z.string().min(1, "Start date is required"),
  valid_to: z.string().nullable().optional(),
  max_uses: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? null : Number(val)),
    z.number().int().positive().nullable().optional(),
  ),
  max_uses_per_user: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? null : Number(val)),
    z.number().int().positive().nullable().optional(),
  ),
  applicable_to_all: z.boolean().default(true),
  is_public: z.boolean().default(true),
}).refine(
  (d) => d.discount_type !== "PERCENTAGE" || d.discount_value <= 100,
  { path: ["discount_value"], message: "Percentage must be between 1 and 100" },
);

export type CouponFormData = z.infer<typeof couponSchema>;

interface CouponFormProps {
  coupon?: Coupon;
}

export function CouponForm({ coupon }: CouponFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const createMutation = useCreateCoupon();
  const updateMutation = useUpdateCoupon();

  const [applicableItems, setApplicableItems] = useState<ApplicableItem[]>(() => {
    if (!coupon?.applicableItems?.length) return [];
    return coupon.applicableItems.map((item) => ({
      item_type: item.itemType,
      course_id: item.courseId,
      book_id: item.bookId,
      bundle_id: item.bundleId,
      batch_id: item.batchId,
      test_series_id: item.testSeriesId,
    }));
  });
  const [itemsChanged, setItemsChanged] = useState(false);

  const handleItemsChange = (items: ApplicableItem[]) => {
    setApplicableItems(items);
    setItemsChanged(true);
  };

  const form = useForm<CouponFormData>({
    resolver: zodResolver(couponSchema),
    defaultValues: coupon
      ? {
          code: coupon.code,
          discount_type: coupon.discountType,
          discount_value: coupon.discountValue,
          valid_from: coupon.validFrom.slice(0, 10),
          valid_to: coupon.validTo ? coupon.validTo.slice(0, 10) : null,
          max_uses: coupon.maxUses ?? null,
          max_uses_per_user: coupon.maxUsesPerUser ?? null,
          applicable_to_all: !coupon.applicableItems?.length,
          is_public: coupon.isPublic ?? true,
        }
      : {
          discount_type: "PERCENTAGE",
          applicable_to_all: true,
          is_public: true,
          valid_from: new Date().toISOString().slice(0, 10),
        },
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
  } = form;

  const applicableToAll = watch("applicable_to_all");
  const isPublic = watch("is_public");
  const isFixed = watch("discount_type") === "FIXED";
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = handleSubmit((data) => {
    const items: CreateCouponApplicableItemRequest[] = !data.applicable_to_all
      ? applicableItems.map((item) => ({
          item_type: item.item_type,
          course_id: item.course_id,
          book_id: item.book_id,
          bundle_id: item.bundle_id,
          batch_id: item.batch_id,
          test_series_id: item.test_series_id,
        }))
      : [];

    const req: CreateCouponRequest = {
      code: data.code.trim().toUpperCase(),
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      valid_from: data.valid_from,
      valid_to: data.valid_to || null,
      max_uses: data.max_uses ?? null,
      max_uses_per_user: data.max_uses_per_user ?? null,
      is_public: data.is_public,
      applicable_to_all: data.applicable_to_all,
      applicable_items: items.length > 0 ? items : undefined,
    };

    if (coupon) {
      updateMutation.mutate(
        { id: coupon.id, data: req },
        {
          onSuccess: () => {
            toast({ title: "Coupon updated" });
            router.push("/dashboard/coupons");
          },
          onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : "Failed to update coupon";
            toast({ title: message, variant: "destructive" });
          },
        },
      );
    } else {
      createMutation.mutate(req, {
        onSuccess: () => {
          toast({ title: "Coupon created" });
          router.push("/dashboard/coupons");
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to create coupon";
          toast({ title: message, variant: "destructive" });
        },
      });
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="code">
          Coupon Code <span className="text-destructive">*</span>
        </Label>
        <Input
          id="code"
          placeholder="e.g. SUMMER20"
          {...register("code")}
          className="uppercase"
        />
        {errors.code && <p className="text-destructive text-xs">{errors.code.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="discount_value">
          {isFixed
            ? `Discount Amount (${coupon?.currency ?? "INR"})`
            : "Discount Percentage (%)"}{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="discount_value"
          type="number"
          min={1}
          max={isFixed ? undefined : 100}
          step={isFixed ? "any" : 1}
          placeholder={isFixed ? "e.g. 500" : "e.g. 20"}
          {...register("discount_value", { valueAsNumber: true })}
        />
        <p className="text-muted-foreground text-xs">
          {isFixed
            ? `A flat ${coupon?.currency ?? "INR"} amount off the price. This coupon only applies to ${coupon?.currency ?? "INR"} orders.`
            : "Enter a value between 1 and 100. The discount will be applied as a percentage off the original price."}
        </p>
        {errors.discount_value && (
          <p className="text-destructive text-xs">{errors.discount_value.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="valid_from">
            Start Date <span className="text-destructive">*</span>
          </Label>
          <Input id="valid_from" type="date" {...register("valid_from")} />
          {errors.valid_from && (
            <p className="text-destructive text-xs">{errors.valid_from.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="valid_to">Expiry Date (optional)</Label>
          <Input id="valid_to" type="date" {...register("valid_to")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max_uses">Max Uses (optional)</Label>
        <Input
          id="max_uses"
          type="number"
          min={1}
          placeholder="Unlimited"
          {...register("max_uses")}
        />
        <p className="text-muted-foreground text-xs">Leave empty for unlimited uses.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max_uses_per_user">Max Uses Per User (optional)</Label>
        <Input
          id="max_uses_per_user"
          type="number"
          min={1}
          placeholder="Unlimited"
          {...register("max_uses_per_user")}
        />
        <p className="text-muted-foreground text-xs">
          Limit how many times a single user can use this coupon. Leave empty for unlimited.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Controller
            control={control}
            name="is_public"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                id="is_public"
              />
            )}
          />
          <Label htmlFor="is_public">List this coupon publicly</Label>
        </div>
        <p className="text-muted-foreground text-xs">
          {isPublic
            ? "Buyers see this coupon as a one-click offer on checkout."
            : "Private: the coupon is never shown anywhere, but still works when a buyer types the code in. Use this for codes you share over email or WhatsApp."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name="applicable_to_all"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              id="applicable_to_all"
            />
          )}
        />
        <Label htmlFor="applicable_to_all">Apply to all products</Label>
      </div>
      {applicableToAll && (
        <p className="text-muted-foreground -mt-3 text-xs">
          Covers courses, books, bundles, batches and test series.
        </p>
      )}

      {!applicableToAll && (
        <ApplicableItemsSelector
          value={applicableItems}
          onChange={handleItemsChange}
        />
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isSubmitting || (!!coupon && !isDirty && !itemsChanged)}
        >
          {isSubmitting && <Loader2 className={cn("mr-2 h-4 w-4 animate-spin")} />}
          {coupon ? "Save Changes" : "Create Coupon"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/coupons")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
