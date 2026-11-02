import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { MyInvoicesClient } from "./my-invoices-client";

export const metadata = {
  title: "My Invoices",
};

export default async function MyInvoicesPage() {
  const pageConfig = await getTemplateForRequest("home");
  const criticalThemeCss = pageConfig
    ? getCriticalThemeCss(pageConfig.theme)
    : "";

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      <MyInvoicesClient
        theme={pageConfig?.theme ?? undefined}
        layout={pageConfig?.layout ?? null}
      />
    </>
  );
}
