"use client";

import { useCurrencyContext } from "@/components/providers/currency-provider";

export interface StorefrontConfig {
  /** Tenant-wide access-managed mode: hide pricing, block self-serve purchase. */
  accessManaged: boolean;
  /** Support email for the Contact Support mailto (null until configured). */
  supportEmail: string | null;
  /** Whether learners can access certificates (Certificates profile tab). Default true. */
  certificatesEnabled: boolean;
  /**
   * When true, learners only see enrolled courses, the public catalog / explore
   * surfaces are hidden. Default false.
   */
  enrolledCoursesOnly: boolean;
  /** True once the storefront context (currency-context response) settled. */
  isLoaded: boolean;
}

/**
 * Access-managed storefront flag + contact target, read from the same
 * /currency-context payload the CurrencyProvider already fetches for every
 * page, no extra request.
 */
export function useStorefrontConfig(): StorefrontConfig {
  const { accessManaged, supportEmail, certificatesEnabled, enrolledCoursesOnly, isLoaded } =
    useCurrencyContext();
  return { accessManaged, supportEmail, certificatesEnabled, enrolledCoursesOnly, isLoaded };
}
