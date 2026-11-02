"use client";

import { useRouter } from "next/navigation";

import { CreateTestWizard } from "@/components/test-series/CreateTestWizard";

/**
 * Dedicated create-test page (replaces the 4-step modal wizard). Reuses
 * CreateTestWizard in `variant="page"` mode so teachers get a full-width,
 * progress-bar flow they can move back and forth through without a cramped dialog.
 */
export default function CreateTestPage() {
  const router = useRouter();
  return (
    <CreateTestWizard
      variant="page"
      open
      onOpenChange={(o) => {
        if (!o) router.push("/dashboard/test-series/tests");
      }}
      onCreated={(testId) =>
        router.push(`/dashboard/test-series/tests/${testId}`)
      }
    />
  );
}
