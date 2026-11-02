import type { Metadata } from "next";

import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";

import { CheckoutPageClient } from "./checkout-page-client";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your purchase",
};

export default async function CheckoutPage() {
  const pageConfig = await getTemplateForRequest("home");
  const criticalThemeCss = pageConfig ? getCriticalThemeCss(pageConfig.theme) : "";
  const layout = pageConfig?.layout ?? null;

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      <CheckoutPageClient layout={layout} pageConfig={pageConfig} />
    </>
  );
}
