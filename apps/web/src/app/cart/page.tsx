import type { Metadata } from "next";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { CartPageClient } from "./cart-page-client";

export const metadata: Metadata = {
  title: "Cart",
  description: "Your shopping cart",
};

export default async function CartPage() {
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
      <CartPageClient layout={layout} pageConfig={pageConfig} />
    </>
  );
}
