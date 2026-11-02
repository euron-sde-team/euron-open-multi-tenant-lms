import { Construction } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Temporarily Unavailable",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  const headersList = headers();
  const tenantName = headersList.get("x-tenant-name");
  const tenantStatus = headersList.get("x-tenant-status");

  const isCancelled = tenantStatus === "CANCELLED";
  const displayName = tenantName || "This academy";

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="bg-muted/50 flex h-20 w-20 items-center justify-center rounded-full">
        <Construction className="text-muted-foreground h-10 w-10" />
      </div>

      <div className="max-w-md text-center">
        <h1 className="text-foreground text-2xl font-bold">
          {isCancelled ? "Currently Unavailable" : "Temporarily Unavailable"}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {isCancelled
            ? `${displayName} is currently unavailable.`
            : `${displayName} is undergoing maintenance and will be back shortly.`}
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          If you have questions, please contact the academy administrator.
        </p>
      </div>
    </div>
  );
}
