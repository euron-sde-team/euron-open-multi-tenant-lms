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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Edit,
  ImageIcon,
  Link2,
  Loader2,
  MessageSquareQuote,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import type { Testimonial } from "@/lib/api/testimonials";
import { uploadApi } from "@/lib/api/upload";
import {
  useTestimonials,
  useTestimonialStats,
  useCreateTestimonial,
  useUpdateTestimonial,
  useDeleteTestimonial,
  useUpdateTestimonialStatus,
} from "@/lib/hooks/use-testimonials";
import { useTenantStore } from "@/lib/stores/tenant-store";

const PAGE_SIZE = 10;

const STATUS_BADGE_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", variant: "outline" },
  APPROVED: { label: "Approved", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_BADGE_MAP[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge
      variant={config.variant}
      className={
        status === "PENDING"
          ? "border-amber-300 bg-amber-50 text-amber-700"
          : status === "APPROVED"
            ? "border-green-300 bg-green-50 text-green-700"
            : status === "REJECTED"
              ? "border-red-300 bg-red-50 text-red-700"
              : ""
      }
    >
      {config.label}
    </Badge>
  );
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-muted-foreground text-sm">--</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

function ImageUploadField({
  value,
  onChange,
  id,
  tenantId,
}: {
  value: string;
  onChange: (url: string) => void;
  id: string;
  tenantId: string;
}) {
  const [mode, setMode] = useState<"upload" | "url">(value && !value.startsWith("blob:") ? "url" : "upload");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const result = await uploadApi.uploadTestimonialImage(file, {
        type: "testimonial_image",
        tenantId,
      });
      onChange(result.url);
    } catch {
      toast({ title: "Error", description: "Failed to upload image.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>Image</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={mode === "upload" ? "default" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setMode("upload")}
          >
            <Upload className="mr-1 h-3 w-3" />
            Upload
          </Button>
          <Button
            type="button"
            variant={mode === "url" ? "default" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setMode("url")}
          >
            <Link2 className="mr-1 h-3 w-3" />
            URL
          </Button>
        </div>
      </div>

      {mode === "upload" ? (
        <div className="space-y-2">
          {value && (
            <div className="relative">
              <img src={value} alt="" className="h-24 w-full rounded-md border object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6"
                onClick={() => onChange("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/30"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ImageIcon className="mb-1 h-5 w-5" />
                <span>Click to upload an image</span>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {value && (
            <div className="relative">
              <img src={value} alt="" className="h-24 w-full rounded-md border object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6"
                onClick={() => onChange("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
          />
        </div>
      )}
    </div>
  );
}

export default function TestimonialsPage() {
  const { toast } = useToast();
  const { selectedTenantId } = useTenantStore();

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formText, setFormText] = useState("");
  const [formRating, setFormRating] = useState<string>("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formSocialLinks, setFormSocialLinks] = useState("");
  const [formMemberEmail, setFormMemberEmail] = useState("");
  const [formStatus, setFormStatus] = useState<string>("APPROVED");

  const { data, isLoading, error } = useTestimonials({
    page,
    limit: PAGE_SIZE,
    search: searchQuery || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const { data: stats } = useTestimonialStats();

  const createTestimonial = useCreateTestimonial();
  const updateTestimonial = useUpdateTestimonial();
  const deleteTestimonial = useDeleteTestimonial();
  const updateStatus = useUpdateTestimonialStatus();

  const testimonials = data?.testimonials ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetForm = () => {
    setFormName("");
    setFormText("");
    setFormRating("");
    setFormImageUrl("");
    setFormSocialLinks("");
    setFormMemberEmail("");
    setFormStatus("APPROVED");
  };

  const openEditDialog = (testimonial: Testimonial) => {
    setEditingTestimonial(testimonial);
    setFormName(testimonial.name);
    setFormText(testimonial.text || "");
    setFormRating(testimonial.rating != null ? String(testimonial.rating) : "");
    setFormImageUrl(testimonial.imageUrl || "");
    setFormSocialLinks(
      testimonial.socialLinks ? JSON.stringify(testimonial.socialLinks, null, 2) : ""
    );
    setFormMemberEmail(testimonial.memberEmail || "");
    setFormStatus(testimonial.status);
  };

  const parseSocialLinks = () => {
    if (!formSocialLinks.trim()) return undefined;
    try {
      return JSON.parse(formSocialLinks);
    } catch {
      toast({ title: "Error", description: "Social links must be valid JSON.", variant: "destructive" });
      return null;
    }
  };

  const handleCreate = () => {
    if (!formName.trim()) return;
    const socialLinks = parseSocialLinks();
    if (socialLinks === null) return;

    createTestimonial.mutate(
      {
        name: formName.trim(),
        text: formText.trim() || undefined,
        image_url: formImageUrl.trim() || undefined,
        social_links: socialLinks,
        rating: formRating ? Number(formRating) : undefined,
        member_email: formMemberEmail.trim() || undefined,
        status: formStatus,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetForm();
          toast({ title: "Success", description: "Testimonial created successfully." });
        },
        onError: (err: Error) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleUpdate = () => {
    if (!editingTestimonial) return;
    const socialLinks = parseSocialLinks();
    if (socialLinks === null) return;

    updateTestimonial.mutate(
      {
        id: editingTestimonial.id,
        data: {
          name: formName.trim() || undefined,
          text: formText.trim() || undefined,
          image_url: formImageUrl.trim() || undefined,
          social_links: socialLinks,
          rating: formRating ? Number(formRating) : undefined,
          member_email: formMemberEmail.trim() || undefined,
          status: formStatus,
        },
      },
      {
        onSuccess: () => {
          setEditingTestimonial(null);
          resetForm();
          toast({ title: "Success", description: "Testimonial updated successfully." });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update testimonial.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTestimonial.mutate(deleteId, {
      onSuccess: () => {
        setDeleteId(null);
        toast({ title: "Success", description: "Testimonial deleted successfully." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete testimonial.", variant: "destructive" });
      },
    });
  };

  const handleStatusChange = (id: string, status: string) => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => {
          toast({ title: "Success", description: `Testimonial ${status.toLowerCase()}.` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testimonials</h1>
          <p className="text-muted-foreground">
            Manage customer testimonials and reviews
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Testimonial
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <MessageSquareQuote className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <MessageSquareQuote className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Approved</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Rejected</p>
                <p className="text-2xl font-bold">{stats.rejected}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search testimonials..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-muted-foreground ml-auto text-sm">
          <strong>{total}</strong> testimonial{total !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">Failed to load testimonials</p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isLoading && !error && testimonials.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Text</th>
                  <th className="px-4 py-3 text-left font-medium">Rating</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {testimonials.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {t.imageUrl ? (
                          <img
                            src={t.imageUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {t.name
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{t.name}</p>
                          {t.memberEmail && (
                            <p className="text-muted-foreground text-xs">{t.memberEmail}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[280px] px-4 py-3">
                      <p className="line-clamp-2 text-muted-foreground">
                        {t.text || "--"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StarRating rating={t.rating} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {t.status !== "APPROVED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-green-600 hover:text-green-700"
                            onClick={() => handleStatusChange(t.id, "APPROVED")}
                            disabled={updateStatus.isPending}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Approve
                          </Button>
                        )}
                        {t.status !== "REJECTED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700"
                            onClick={() => handleStatusChange(t.id, "REJECTED")}
                            disabled={updateStatus.isPending}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Reject
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(t)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8"
                          onClick={() => setDeleteId(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && testimonials.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquareQuote className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">
              {searchQuery || statusFilter !== "all"
                ? "No testimonials found"
                : "No testimonials yet"}
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filter"
                : "Add your first testimonial to get started"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button
                onClick={() => {
                  resetForm();
                  setIsCreateOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Testimonial
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Testimonial</DialogTitle>
            <DialogDescription>
              Create a new testimonial. You can optionally link it to a tenant member.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-text">Testimonial Text</Label>
              <Textarea
                id="create-text"
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="What did they say?"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-rating">Rating</Label>
                <Select value={formRating} onValueChange={setFormRating}>
                  <SelectTrigger id="create-rating">
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Star</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-status">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger id="create-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ImageUploadField
              id="create-image"
              value={formImageUrl}
              onChange={setFormImageUrl}
              tenantId={selectedTenantId ?? ""}
            />
            <div className="space-y-2">
              <Label htmlFor="create-member">Member Email</Label>
              <Input
                id="create-member"
                type="email"
                value={formMemberEmail}
                onChange={(e) => setFormMemberEmail(e.target.value)}
                placeholder="member@example.com"
              />
              <p className="text-muted-foreground text-xs">
                Optionally link this testimonial to an existing member by email.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-social">Social Links (JSON)</Label>
              <Textarea
                id="create-social"
                value={formSocialLinks}
                onChange={(e) => setFormSocialLinks(e.target.value)}
                placeholder={'{\n  "linkedin": "https://...",\n  "twitter": "https://..."\n}'}
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createTestimonial.isPending || !formName.trim()}
            >
              {createTestimonial.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Testimonial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTestimonial}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTestimonial(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Testimonial</DialogTitle>
            <DialogDescription>Update testimonial details.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-text">Testimonial Text</Label>
              <Textarea
                id="edit-text"
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-rating">Rating</Label>
                <Select value={formRating} onValueChange={setFormRating}>
                  <SelectTrigger id="edit-rating">
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Star</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ImageUploadField
              id="edit-image"
              value={formImageUrl}
              onChange={setFormImageUrl}
              tenantId={selectedTenantId ?? ""}
            />
            <div className="space-y-2">
              <Label htmlFor="edit-member">Member Email</Label>
              <Input
                id="edit-member"
                type="email"
                value={formMemberEmail}
                onChange={(e) => setFormMemberEmail(e.target.value)}
                placeholder="member@example.com"
              />
              <p className="text-muted-foreground text-xs">
                Optionally link this testimonial to an existing member by email.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-social">Social Links (JSON)</Label>
              <Textarea
                id="edit-social"
                value={formSocialLinks}
                onChange={(e) => setFormSocialLinks(e.target.value)}
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingTestimonial(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateTestimonial.isPending}
            >
              {updateTestimonial.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Testimonial</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this testimonial? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTestimonial.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
