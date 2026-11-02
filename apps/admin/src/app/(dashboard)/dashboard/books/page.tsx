"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useToast,
  PartOfBundleBadge,
} from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FeatureGate } from "@/components/feature-gate/FeatureGate";
import { SortableCardGrid } from "@/components/ordered-products/sortable-card-grid";
import { useCatalogOrdering } from "@/components/ordered-products/use-catalog-ordering";
import { CopyLinkButton } from "@/components/shared/copy-link-button";
import { TenantSelector } from "@/components/tenant-selector";
import { captureEvent } from "@/lib/analytics";
import { booksApi, type Book } from "@/lib/api/books";
import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import { availableRoutesKeys } from "@/lib/hooks/use-available-routes";
import { useTenantWebBaseUrl } from "@/lib/hooks/use-tenant-domain-url";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { generateSlug } from "@/lib/utils/slug";

// Book data structure for list display
interface BookListItem {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl?: string;
  isPublished: boolean;
  status: string;
  fileFormat: "EPUB" | "PDF";
  updatedAt: string;
  bundles?: { id: string; title: string; slug: string }[];
}

// Convert API Book to BookListItem
function apiBookToListItem(book: Book): BookListItem {
  return {
    id: book.id,
    title: book.title,
    slug: book.slug,
    thumbnailUrl: book.thumbnailUrl || undefined,
    isPublished: book.status === "PUBLISHED",
    status: book.status,
    fileFormat: book.fileFormat ?? "EPUB",
    updatedAt: book.updatedAt,
    bundles: book.bundles ?? [],
  };
}

export default function BooksPage() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedTenantId, selectedTenant } = useTenantStore();
  const tenantWebBaseUrl = useTenantWebBaseUrl();

  const [searchQuery, setSearchQuery] = useState("");
  const [purchaseFilter, setPurchaseFilter] = useState<"all" | "FREE" | "PAID">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booksData, setBooksData] = useState<BookListItem[]>([]);

  // Load books from API
  const loadBooks = useCallback(async () => {
    if (!selectedTenantId) {
      setBooksData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch books from the dedicated books API
      const filters =
        purchaseFilter === "all"
          ? undefined
          : { purchaseMode: purchaseFilter };
      const response = await booksApi.getBooks(1, 100, filters);
      const books = response.books.map(apiBookToListItem);
      setBooksData(books);
    } catch (err) {
      console.error("Failed to load books:", err);
      setError("Failed to load books. Please try again.");
      setBooksData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTenantId, purchaseFilter]);

  // Load books when tenant changes
  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Filter books by search query
  const filteredBooks = useMemo(() => {
    if (!booksData) return [];
    if (!searchQuery.trim()) return booksData;

    const query = searchQuery.toLowerCase();
    return booksData.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        book.slug.toLowerCase().includes(query)
    );
  }, [booksData, searchQuery]);

  // Dragging is off while a search or purchase filter narrows the list: a
  // reorder has to describe the whole list, and the rows you can't see still
  // have positions.
  const ordering = useCatalogOrdering({
    entity: "books",
    isFiltered: searchQuery.trim().length > 0 || purchaseFilter !== "all",
    onSaved: loadBooks,
  });

  // Compute stats
  const stats = useMemo(() => {
    const books = booksData || [];
    return {
      total: books.length,
      published: books.filter((b) => b.isPublished).length,
      draft: books.filter((b) => !b.isPublished).length,
    };
  }, [booksData]);

  // Generate slug preview from title
  const slugPreview = useMemo(() => {
    if (!newBookTitle.trim()) return "";
    return generateSlug(newBookTitle);
  }, [newBookTitle]);

  // Handle create book
  const handleCreateBook = async () => {
    if (!selectedTenantId) {
      toast({
        title: "Error",
        description: "Please select a tenant first.",
        variant: "destructive",
      });
      return;
    }

    if (!newBookTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a book title.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      // Create book via the books API
      const newBook = await booksApi.createBook({
        title: newBookTitle.trim(),
        slug: generateSlug(newBookTitle),
      });

      captureEvent("book_created", {
        book_id: newBook.id,
        tenant_id: selectedTenantId,
      });

      setIsCreateDialogOpen(false);
      setNewBookTitle("");

      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });

      toast({
        title: "Success",
        description: "Book created successfully. Redirecting to editor...",
      });

      router.push(`/dashboard/books/${newBook.id}/editor`);
    } catch (err) {
      console.error("Failed to create book:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create book. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle delete book
  const handleDeleteBook = async () => {
    if (!deleteBookId) return;

    setIsDeleting(true);

    try {
      await booksApi.deleteBook(deleteBookId);

      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      setBooksData((prev) => prev.filter((b) => b.id !== deleteBookId));
      setDeleteBookId(null);

      toast({
        title: "Success",
        description: "Book deleted successfully.",
      });
    } catch (err) {
      console.error("Failed to delete book:", err);
      toast({
        title: "Error",
        description: "Failed to delete book. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle toggle publish
  const handleTogglePublish = async (bookId: string, currentStatus: boolean) => {
    setIsToggling(bookId);

    try {
      const updatedBook = await booksApi.togglePublish(bookId, !currentStatus);

      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      setBooksData((prev) =>
        prev.map((b) =>
          b.id === bookId ? { ...b, isPublished: updatedBook.status === "PUBLISHED", status: updatedBook.status } : b
        )
      );

      toast({
        title: "Success",
        description: currentStatus
          ? "Book unpublished."
          : "Book published successfully.",
      });
    } catch (err) {
      console.error("Failed to toggle publish status:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to update publish status. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsToggling(null);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <FeatureGate featureKeys={["books"]}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Books</h1>
          <p className="text-muted-foreground">
            Manage books for {selectedTenant?.tenant_name || "your tenant"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TenantSelector />
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={!selectedTenantId}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Ebook
          </Button>
        </div>
      </div>

      {/* No Tenant Selected */}
      {!selectedTenantId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-center">
              Please select a tenant to view and manage books.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {selectedTenantId && (
        <div className="space-y-6">
          {/* Search, Filter and Stats */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search books..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "FREE", "PAID"] as const).map((f) => (
                  <Button
                    key={f}
                    variant={purchaseFilter === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPurchaseFilter(f)}
                  >
                    {f === "all" ? "All Books" : f === "FREE" ? "Free Books" : "Paid Books"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <span>
                  <strong>{stats.total}</strong> Total
                </span>
                <span>
                  <strong>{stats.published}</strong> Published
                </span>
                <span>
                  <strong>{stats.draft}</strong> Draft
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadBooks}
                disabled={isLoading}
                title="Refresh"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-destructive">{error}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={loadBooks}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Books Grid */}
          {!isLoading && !error && filteredBooks.length > 0 && (
            <SortableCardGrid
              items={filteredBooks}
              getId={(book) => book.id}
              getLabel={(book) => book.title}
              enabled={ordering.canDrag}
              onReorder={ordering.save}
              className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              renderCard={(book) => (
                <Card key={book.id} className="group relative border-t-0">
                  {/* Thumbnail - square keeps vertical mode with compact height */}
                  <div className="bg-muted relative aspect-[1/1] overflow-hidden rounded-lg">
                    {(() => {
                      const url = resolveThumbnailForDisplay(book.thumbnailUrl);
                      return url ? (
                        <img
                          src={url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null;
                    })()}
                    {/* Part-of-bundle, bottom left, clear of the grip handle
                        above and the status badges opposite. */}
                    {book.bundles && book.bundles.length > 0 && (
                      <div className="absolute bottom-2 left-2 right-2 z-10">
                        <PartOfBundleBadge bundles={book.bundles} asLink={false} onImage />
                      </div>
                    )}
                    {/* Status + format badges */}
                    {/* Hover Actions */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/dashboard/books/${book.id}/editor`}>
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <CardHeader className="py-1.5 pb-0.5">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="line-clamp-1 text-base">
                          {book.title}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs">
                          /books/{book.slug}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2">
                      <Badge variant="outline">{book.fileFormat}</Badge>
                      <Badge
                        variant={book.isPublished ? "default" : "secondary"}
                      >
                        {book.isPublished ? "Published" : "Draft"}
                      </Badge>
                  </div>

                  <CardContent className="pt-0 pb-2">
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground text-xs">
                        Updated {formatDate(book.updatedAt)}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Publish/Unpublish Button */}
                        {!book.isPublished ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() =>
                              handleTogglePublish(book.id, book.isPublished)
                            }
                            disabled={isToggling === book.id}
                          >
                            {isToggling === book.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            Publish
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() =>
                              handleTogglePublish(book.id, book.isPublished)
                            }
                            disabled={isToggling === book.id}
                          >
                            {isToggling === book.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                            Unpublish
                          </Button>
                        )}

                        {/* Edit Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                          title="Edit Book"
                        >
                          <Link href={`/dashboard/books/${book.id}/editor`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>

                        {/* Bulk grant access Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                            title="Bulk grant access"
                          >
                            <Link href={`/dashboard/books/${book.id}/bulk-grant`}>
                              <UserPlus className="h-4 w-4" />
                            </Link>
                          </Button>

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8"
                          onClick={() => setDeleteBookId(book.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Full-width public share link, published books only */}
                      {book.isPublished && (
                        <CopyLinkButton
                          display="full"
                          label="Book"
                          url={tenantWebBaseUrl ? `${tenantWebBaseUrl}/books/${book.slug}` : ""}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            />
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredBooks.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-medium">
                  {searchQuery ? "No books found" : "No books yet"}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Get started by creating your first book"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Book
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Book Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Ebook</DialogTitle>
            <DialogDescription>
              Enter a title for your ebook. You can add details, pricing, and
              upload an EPUB or PDF in the editor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="book-title">Ebook Title</Label>
              <Input
                id="book-title"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                placeholder="e.g., Complete Python Guide"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBookTitle.trim()) {
                    handleCreateBook();
                  }
                }}
              />
              {slugPreview && (
                <p className="text-muted-foreground font-mono text-xs">
                  /books/{slugPreview}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewBookTitle("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBook}
              disabled={isCreating || !newBookTitle.trim()}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Ebook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteBookId}
        onOpenChange={(open) => !open && setDeleteBookId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this book? This action cannot be
              undone and will remove all book content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBook}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </FeatureGate>
  );
}
