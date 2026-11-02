import type { Metadata } from "next";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { AttemptClient } from "./attempt-client";

interface Props {
  params: Promise<{ slug: string; testId: string; attemptId: string }>;
}

export const metadata: Metadata = {
  title: "Test attempt",
  // Discourage indexing of in-progress attempts
  robots: { index: false, follow: false },
};

export default async function AttemptPage({ params }: Props) {
  const { slug, testId, attemptId } = await params;
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
      <AttemptClient
        slug={slug}
        testId={testId}
        attemptId={attemptId}
        theme={pageConfig?.theme ?? undefined}
      />
    </>
  );
}
