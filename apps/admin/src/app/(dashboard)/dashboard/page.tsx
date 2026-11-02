"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The dashboard entry point: a straight redirect to the overview. */
export default function DashboardEntryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/overview");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="sr-only">Opening your dashboard</span>
    </div>
  );
}
