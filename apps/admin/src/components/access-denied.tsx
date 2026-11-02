"use client";

import { Button } from "@open-mtlms/core";
import { ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";

export function AccessDenied() {
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldX className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold">Access Denied</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        You don&apos;t have permission to access this page. Contact your
        organization owner to request access.
      </p>
      <Button variant="outline" onClick={() => router.back()}>
        Go Back
      </Button>
    </div>
  );
}
