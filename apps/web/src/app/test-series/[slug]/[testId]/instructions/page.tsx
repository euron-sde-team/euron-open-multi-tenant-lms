import type { Metadata } from "next";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { InstructionsClient } from "./instructions-client";

interface Props {
  params: Promise<{ slug: string; testId: string }>;
}

export const metadata: Metadata = {
  title: "Test instructions",
};

export default async function InstructionsPage({ params }: Props) {
  const { slug, testId } = await params;
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
      <InstructionsClient
        slug={slug}
        testId={testId}
        theme={pageConfig?.theme ?? undefined}
        layout={pageConfig?.layout ?? null}
      />
    </>
  );
}
