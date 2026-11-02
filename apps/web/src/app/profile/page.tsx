import type { Metadata } from "next";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { ProfileClient } from "@/components/profile/profile-client";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your account settings and preferences.",
};

export default async function ProfilePage() {
  let pageConfig = await getTemplateForRequest("profile");
  const homeConfig = await getTemplateForRequest("home");

  if (!pageConfig && homeConfig) {
    pageConfig = {
      ...homeConfig,
      id: "profile-fallback",
      slug: "profile",
      title: "Profile",
      sections: [
        {
          id: "member-profile-default",
          type: "member-profile",
          variant: "default",
          order: 0,
          visible: true,
          deleted: false,
          content: { headline: "Profile", subheadline: "Manage your account settings" },
          settings: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      layout: homeConfig.layout,
      theme: homeConfig.theme,
    };
  } else if (!pageConfig) {
    const now = new Date().toISOString();
    pageConfig = {
      id: "profile-minimal",
      tenantId: "",
      slug: "profile",
      title: "Profile",
      sections: [
        {
          id: "member-profile-default",
          type: "member-profile",
          variant: "default",
          order: 0,
          visible: true,
          deleted: false,
          content: { headline: "Profile", subheadline: "Manage your account settings" },
          settings: {},
          createdAt: now,
          updatedAt: now,
        },
      ],
      layout: homeConfig?.layout ?? undefined,
      theme: homeConfig?.theme ?? defaultThemeConfig,
      seo: { title: "Profile", description: "Manage your account settings and preferences." },
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  const criticalThemeCss = pageConfig.theme ? getCriticalThemeCss(pageConfig.theme) : "";
  const layout = pageConfig.layout ?? homeConfig?.layout ?? undefined;

  return (
    <>
      {criticalThemeCss && (
        <style dangerouslySetInnerHTML={{ __html: criticalThemeCss }} data-tenant-critical-theme />
      )}
      <ProfileClient
        layout={layout}
        theme={pageConfig.theme ?? undefined}
        sections={pageConfig.sections ?? []}
        availableRoutes={pageConfig.availableRoutes}
      />
    </>
  );
}
