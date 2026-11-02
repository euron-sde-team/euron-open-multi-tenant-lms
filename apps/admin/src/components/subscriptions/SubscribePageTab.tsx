"use client";

import { Button } from "@open-mtlms/core";
import { ExternalLink, Paintbrush } from "lucide-react";
import Link from "next/link";

export function SubscribePageTab() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
      <Paintbrush className="text-muted-foreground/50 mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-semibold">Subscribe Page Editor</h3>
      <p className="text-muted-foreground mb-6 max-w-sm text-center text-sm">
        Customize the sections displayed on your subscription landing page using the full visual
        editor.
      </p>
      <Button asChild>
        <Link href="/dashboard/subscriptions/editor">
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Editor
        </Link>
      </Button>
    </div>
  );
}
