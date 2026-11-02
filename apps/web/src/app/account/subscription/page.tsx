import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { SubscriptionClient } from "./subscription-client";

export const metadata = {
  title: "My Subscription",
  description: "Manage your subscription.",
};

export default async function AccountSubscriptionPage() {
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
      <SubscriptionClient
        theme={pageConfig?.theme ?? undefined}
        layout={pageConfig?.layout ?? null}
      />
    </>
  );
}
