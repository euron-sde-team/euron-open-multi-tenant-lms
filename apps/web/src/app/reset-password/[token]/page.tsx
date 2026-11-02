import type { Metadata } from "next";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { ResetPasswordClient } from "./reset-password-client";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your account.",
};

export default async function ResetPasswordPage({
  params,
}: {
  params: { token: string };
}) {
  const pageConfig = await getTemplateForRequest("home");
  const criticalThemeCss = pageConfig?.theme ? getCriticalThemeCss(pageConfig.theme) : "";

  return (
    <>
      {criticalThemeCss && (
        <style dangerouslySetInnerHTML={{ __html: criticalThemeCss }} data-tenant-critical-theme />
      )}
      <ResetPasswordClient theme={pageConfig?.theme ?? undefined} token={params.token} />
    </>
  );
}
