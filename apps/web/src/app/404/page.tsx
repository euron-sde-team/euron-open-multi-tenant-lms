import { Globe } from "lucide-react";
import type { Metadata } from "next";

import { BRAND_NAME, BRAND_URL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Academy Not Found",
  robots: { index: false, follow: false },
};

export default function AcademyNotFoundPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="bg-muted/50 flex h-20 w-20 items-center justify-center rounded-full">
        <Globe className="text-muted-foreground h-10 w-10" />
      </div>

      <div className="max-w-md text-center">
        <h1 className="text-foreground text-2xl font-bold">Academy Not Found</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          We couldn&apos;t find an academy at this address. Please check the URL
          and try again.
        </p>
      </div>

      <a
        href={BRAND_URL}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
      >
        Visit {BRAND_NAME}
      </a>
    </div>
  );
}
