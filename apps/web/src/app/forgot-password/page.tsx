import type { Metadata } from "next";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { ForgotPasswordClient } from "./forgot-password-client";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your account password.",
};

export default async function ForgotPasswordPage() {
  const pageConfig = await getTemplateForRequest("home");
  const criticalThemeCss = pageConfig?.theme ? getCriticalThemeCss(pageConfig.theme) : "";

  return (
    <>
      {criticalThemeCss && (
        <style dangerouslySetInnerHTML={{ __html: criticalThemeCss }} data-tenant-critical-theme />
      )}
      <ForgotPasswordClient theme={pageConfig?.theme ?? undefined} />
    </>
  );
}
