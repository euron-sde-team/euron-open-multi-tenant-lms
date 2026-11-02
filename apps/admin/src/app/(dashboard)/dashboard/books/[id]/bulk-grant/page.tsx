"use client";

import { Button } from "@open-mtlms/core";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BulkImportPage } from "../../../../../../components/bulk-import/BulkImportPage";
import { booksApi } from "@/lib/api/books";

interface ResolvedBook {
  id: string;
  title: string;
}

export default function BookBulkGrantPage() {
  const params = useParams<{ id: string }>();
  const bookId = params?.id ?? "";
  const [book, setBook] = useState<ResolvedBook | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!bookId) return;
    (async () => {
      try {
        const b = await booksApi.getBook(bookId);
        if (!b) throw new Error("Book not found");
        if (!cancelled) setBook({ id: b.id, title: b.title });
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to resolve book");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/books">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to books
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Bulk grant access</h1>
        </div>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!book && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Resolving book...
          </div>
        )}

        {book && (
          <BulkImportPage
            scope="BOOK"
            bookId={book.id}
            contextTitle={book.title}
            contextSubtitle="New and reactivated access entries use the selected validity; existing active grants are never modified."
          />
        )}
      </div>
    </>
  );
}
