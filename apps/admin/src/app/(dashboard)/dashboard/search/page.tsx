"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search</h1>
        <p className="text-muted-foreground">
          {q ? `Search results for "${q}"` : "Enter a search term to find content"}
        </p>
      </div>

      {q ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center">
          <Search className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">
            Search across pages, courses, books, and more. Results will appear here.
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            Query: <strong>{q}</strong>
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-8 text-center">
          <Search className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">
            Use the search bar in the header to search for content.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="animate-pulse p-8">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}
