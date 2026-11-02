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
  Textarea,
  useToast,
} from "@open-mtlms/core";
import {
  Edit,
  GraduationCap,
  Loader2,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FeatureGate } from "@/components/feature-gate/FeatureGate";
import {
  useEntitlements,
  getProductUsage,
} from "@/lib/hooks/use-entitlements";
import {
  useInstructors,
  useCreateInstructor,
  useUpdateInstructor,
  useDeleteInstructor,
} from "@/lib/hooks/use-instructors";
import { useTenantStore } from "@/lib/stores/tenant-store";
import type { Instructor } from "@/lib/types/instructor";

export default function InstructorsPage() {
  const { toast } = useToast();
  const { selectedTenantId, selectedTenant } = useTenantStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formExpertise, setFormExpertise] = useState("");

  const { data, isLoading, error } = useInstructors(selectedTenantId || undefined);
  const { data: entitlements } = useEntitlements(selectedTenantId || undefined);
  const usage = getProductUsage(entitlements, "instructors_count");

  const createInstructor = useCreateInstructor();
  const updateInstructor = useUpdateInstructor();
  const deleteInstructor = useDeleteInstructor();

  const filteredInstructors = useMemo(() => {
    if (!data?.instructors) return [];
    if (!searchQuery.trim()) return data.instructors;
    const q = searchQuery.toLowerCase();
    return data.instructors.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.email && i.email.toLowerCase().includes(q)) ||
        (i.expertise && i.expertise.toLowerCase().includes(q))
    );
  }, [data?.instructors, searchQuery]);

  const resetCreateForm = () => {
    setFormName("");
    setFormEmail("");
    setFormBio("");
    setFormExpertise("");
  };

  const openEditDialog = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    setFormName(instructor.name);
    setFormEmail(instructor.email || "");
    setFormBio(instructor.bio || "");
    setFormExpertise(instructor.expertise || "");
  };

  const handleCreate = () => {
    if (!selectedTenantId || !formName.trim()) return;
    createInstructor.mutate(
      {
        name: formName.trim(),
        email: formEmail.trim() || null,
        bio: formBio.trim() || null,
        expertise: formExpertise.trim() || null,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetCreateForm();
          toast({ title: "Success", description: "Instructor added successfully." });
        },
        onError: (err: Error & { code?: string }) => {
          const isEntitlement = err.code === "ENTITLEMENT_LIMIT_REACHED" || err.code === "ENTITLEMENT_FEATURE_DISABLED";
          toast({
            title: isEntitlement ? "Plan limit" : "Error",
            description: err.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUpdate = () => {
    if (!editingInstructor) return;
    updateInstructor.mutate(
      {
        instructorId: editingInstructor.id,
        data: {
          name: formName.trim() || undefined,
          email: formEmail.trim() || null,
          bio: formBio.trim() || null,
          expertise: formExpertise.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setEditingInstructor(null);
          toast({ title: "Success", description: "Instructor updated successfully." });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update instructor.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteInstructor.mutate(deleteId, {
      onSuccess: () => {
        setDeleteId(null);
        toast({ title: "Success", description: "Instructor removed successfully." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to remove instructor.", variant: "destructive" });
      },
    });
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <FeatureGate featureKeys={["instructors"]}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instructors</h1>
          <p className="text-muted-foreground">
            Manage instructors for {selectedTenant?.tenant_name || "your tenant"}
          </p>
          {selectedTenantId && (
            <p className="text-muted-foreground mt-1 text-sm">
              {usage.used} / {usage.isUnlimited ? "Unlimited" : usage.limit} instructors
            </p>
          )}
        </div>
        <Button
          onClick={() => { resetCreateForm(); setIsCreateOpen(true); }}
          disabled={!selectedTenantId || !usage.allowedToAddOne}
          title={!usage.allowedToAddOne ? "Instructor limit reached. Upgrade your plan." : undefined}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Instructor
        </Button>
      </div>

      {!selectedTenantId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-center">
              Please select a tenant to view and manage instructors.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedTenantId && (
        <div className="space-y-6">
          {/* Search */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search instructors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-muted-foreground text-sm">
              <strong>{filteredInstructors.length}</strong> instructor{filteredInstructors.length !== 1 ? "s" : ""}
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          )}

          {error && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-destructive">Failed to load instructors</p>
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && filteredInstructors.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredInstructors.map((instructor) => (
                <Card key={instructor.id} className="group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm overflow-hidden">
                        {instructor.profileUrl ? (
                          <img src={instructor.profileUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initials(instructor.name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="line-clamp-1 text-base">{instructor.name}</CardTitle>
                        <CardDescription className="line-clamp-1 text-xs">{instructor.email || "No email"}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {instructor.expertise && (
                        <Badge variant="secondary" className="text-xs">
                          {instructor.expertise}
                        </Badge>
                      )}
                      {instructor.bio && (
                        <p className="text-muted-foreground line-clamp-2 text-sm">{instructor.bio}</p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link href={`/dashboard/instructors/${instructor.id}`}>
                            <User className="mr-1 h-3 w-3" />
                            View Profile
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(instructor)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setDeleteId(instructor.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && !error && filteredInstructors.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-medium">
                  {searchQuery ? "No instructors found" : "No instructors yet"}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {searchQuery ? "Try adjusting your search" : "Add your first instructor to get started"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => { resetCreateForm(); setIsCreateOpen(true); }} disabled={!usage.allowedToAddOne}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Instructor
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Instructor</DialogTitle>
            <DialogDescription>
              Create a new instructor profile. You can upload a photo after creating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="instructor@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expertise">Expertise / Title</Label>
              <Input
                id="expertise"
                value={formExpertise}
                onChange={(e) => setFormExpertise(e.target.value)}
                placeholder="e.g., Machine Learning Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formBio}
                onChange={(e) => setFormBio(e.target.value)}
                placeholder="A short bio about the instructor"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInstructor.isPending || !formName.trim()}>
              {createInstructor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Instructor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingInstructor} onOpenChange={(open) => !open && setEditingInstructor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Instructor</DialogTitle>
            <DialogDescription>Update instructor profile details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expertise / Title</Label>
              <Input value={formExpertise} onChange={(e) => setFormExpertise(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInstructor(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateInstructor.isPending}>
              {updateInstructor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Instructor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will remove the instructor profile and all associated experiences.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteInstructor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </FeatureGate>
  );
}
