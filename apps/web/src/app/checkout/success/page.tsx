import type { Metadata } from "next";

import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";

import { SuccessPageClient } from "./success-page-client";

export const metadata: Metadata = {
  title: "Payment Successful",
  description: "Your purchase has been confirmed",
};

export default async function CheckoutSuccessPage() {
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
      <SuccessPageClient layout={layout} pageConfig={pageConfig} />
    </>
  );
}
