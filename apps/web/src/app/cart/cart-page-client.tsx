"use client";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { emptyLayout } from "@/lib/default-layout";
import { AvailableRoutesProvider } from "@open-mtlms/core";
import type { PageConfig, SectionConfig, TenantLayout } from "@open-mtlms/shared";
import { getAvailableRoutesResponse } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";

const CART_SECTION: SectionConfig = {
  id: "cart-system",
  type: "cart-page",
  variant: "default",
  order: 0,
  visible: true,
  deleted: false,
  content: {
    headline: "Your Cart",
    subheadline: "Review your items and proceed to checkout",
    checkoutButtonText: "Proceed to Checkout",
    emptyCartMessage: "Your cart is empty. Add courses to get started!",
  },
  settings: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface CartPageClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
}

export function CartPageClient({ layout, pageConfig }: CartPageClientProps) {
  const theme = pageConfig?.theme ?? defaultThemeConfig;
  const effectiveLayout = layout ?? emptyLayout;

  return (
    <TenantThemeProvider theme={theme}>
      <AvailableRoutesProvider
        initialRoutes={pageConfig?.availableRoutes ?? getAvailableRoutesResponse()}
      >
        <LayoutWrapper layout={effectiveLayout} theme={theme}>
          <SectionRenderer sections={[CART_SECTION]} editMode={false} />
        </LayoutWrapper>
      </AvailableRoutesProvider>
    </TenantThemeProvider>
  );
}
