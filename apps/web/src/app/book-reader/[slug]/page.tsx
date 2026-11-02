import type { Metadata } from "next";
import { BookReaderClient } from "./book-reader-client";

interface BookReaderPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BookReaderPageProps): Promise<Metadata> {
  const { slug } = await params;

  // Title is just the book slug-derived label; the root layout appends
  // " | <TenantName>" via its template so this stays multi-tenant safe.
  return {
    title: slug,
  };
}

export default async function BookReaderPage({ params }: BookReaderPageProps) {
  const { slug } = await params;

  return <BookReaderClient slug={slug} />;
}
