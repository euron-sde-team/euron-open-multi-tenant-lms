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
  ArrowLeft,
  Briefcase,
  Edit,
  Globe,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import { InstructorPhotoUploader } from "@/components/instructors/InstructorPhotoUploader";
import {
  useInstructor,
  useExperiences,
  useCreateExperience,
  useUpdateExperience,
  useDeleteExperience,
  useSocials,
  useUpsertSocials,
  useUploadProfilePhoto,
  useDeleteProfilePhoto,
  useUploadCompanyLogo,
  useDeleteCompanyLogo,
} from "@/lib/hooks/use-instructors";
import { useTenantStore } from "@/lib/stores/tenant-store";
import type { InstructorExperience } from "@/lib/types/instructor";

export default function InstructorDetailPage() {
  const params = useParams();
  const instructorId = typeof params?.id === "string" ? params.id : params?.id?.[0] ?? "";
  const { toast } = useToast();
  const { selectedTenantId } = useTenantStore();

  const { data: instructor, isLoading } = useInstructor(selectedTenantId || undefined, instructorId);
  const { data: experiences } = useExperiences(instructorId || undefined);
  const { data: socials } = useSocials(instructorId || undefined);

  // Experience form
  const [isExpDialogOpen, setIsExpDialogOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<InstructorExperience | null>(null);
  const [deleteExpId, setDeleteExpId] = useState<string | null>(null);
  const [expCompany, setExpCompany] = useState("");
  const [expYears, setExpYears] = useState("");
  const [expDetails, setExpDetails] = useState("");

  // Socials form
  const [isSocialsOpen, setIsSocialsOpen] = useState(false);
  const [sLinkedin, setSLinkedin] = useState("");
  const [sTwitter, setSTwitter] = useState("");
  const [sYoutube, setSYoutube] = useState("");
  const [sGithub, setSGithub] = useState("");
  const [sWebsite, setSWebsite] = useState("");
  const [sFacebook, setSFacebook] = useState("");
  const [sInstagram, setSInstagram] = useState("");

  const createExperience = useCreateExperience();
  const updateExperience = useUpdateExperience();
  const deleteExperience = useDeleteExperience();
  const upsertSocials = useUpsertSocials();
  const uploadProfilePhoto = useUploadProfilePhoto();
  const deleteProfilePhoto = useDeleteProfilePhoto();
  const uploadCompanyLogo = useUploadCompanyLogo();
  const deleteCompanyLogo = useDeleteCompanyLogo();

  const resetExpForm = () => {
    setExpCompany("");
    setExpYears("");
    setExpDetails("");
    setEditingExp(null);
  };

  const openAddExp = () => {
    resetExpForm();
    setIsExpDialogOpen(true);
  };

  const openEditExp = (exp: InstructorExperience) => {
    setEditingExp(exp);
    setExpCompany(exp.company);
    setExpYears(String(exp.years));
    setExpDetails(exp.details || "");
    setIsExpDialogOpen(true);
  };

  const handleSaveExp = () => {
    const years = parseInt(expYears, 10);
    if (!expCompany.trim() || isNaN(years)) return;

    if (editingExp) {
      updateExperience.mutate(
        {
          instructorId,
          experienceId: editingExp.id,
          data: {
            company: expCompany.trim(),
            years,
            details: expDetails.trim() || null,
          },
        },
        {
          onSuccess: () => {
            setIsExpDialogOpen(false);
            resetExpForm();
            toast({ title: "Success", description: "Experience updated." });
          },
          onError: () => toast({ title: "Error", description: "Failed to update experience.", variant: "destructive" }),
        }
      );
    } else {
      createExperience.mutate(
        {
          instructorId,
          data: {
            company: expCompany.trim(),
            years,
            details: expDetails.trim() || null,
          },
        },
        {
          onSuccess: () => {
            setIsExpDialogOpen(false);
            resetExpForm();
            toast({ title: "Success", description: "Experience added." });
          },
          onError: () => toast({ title: "Error", description: "Failed to add experience.", variant: "destructive" }),
        }
      );
    }
  };

  const handleDeleteExp = () => {
    if (!deleteExpId) return;
    deleteExperience.mutate(
      { instructorId, experienceId: deleteExpId },
      {
        onSuccess: () => { setDeleteExpId(null); toast({ title: "Success", description: "Experience removed." }); },
        onError: () => toast({ title: "Error", description: "Failed to remove experience.", variant: "destructive" }),
      }
    );
  };

  const openSocialsEdit = () => {
    setSLinkedin(socials?.linkedinUrl || "");
    setSTwitter(socials?.twitterUrl || "");
    setSYoutube(socials?.youtubeUrl || "");
    setSGithub(socials?.githubUrl || "");
    setSWebsite(socials?.websiteUrl || "");
    setSFacebook(socials?.facebookUrl || "");
    setSInstagram(socials?.instagramUrl || "");
    setIsSocialsOpen(true);
  };

  const handleSaveSocials = () => {
    upsertSocials.mutate(
      {
        instructorId,
        data: {
          linkedin_url: sLinkedin.trim() || null,
          twitter_url: sTwitter.trim() || null,
          youtube_url: sYoutube.trim() || null,
          github_url: sGithub.trim() || null,
          website_url: sWebsite.trim() || null,
          facebook_url: sFacebook.trim() || null,
          instagram_url: sInstagram.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setIsSocialsOpen(false);
          toast({ title: "Success", description: "Social links saved." });
        },
        onError: () => toast({ title: "Error", description: "Failed to save social links.", variant: "destructive" }),
      }
    );
  };

  const handleUploadProfilePhoto = useCallback(async (file: File) => {
    await uploadProfilePhoto.mutateAsync({ instructorId, file });
  }, [instructorId, uploadProfilePhoto]);

  const handleDeleteProfilePhoto = useCallback(async () => {
    await deleteProfilePhoto.mutateAsync(instructorId);
  }, [instructorId, deleteProfilePhoto]);

  const handleUploadCompanyLogo = useCallback(async (experienceId: string, file: File) => {
    await uploadCompanyLogo.mutateAsync({ instructorId, experienceId, file });
  }, [instructorId, uploadCompanyLogo]);

  const handleDeleteCompanyLogo = useCallback(async (experienceId: string) => {
    await deleteCompanyLogo.mutateAsync({ instructorId, experienceId });
  }, [instructorId, deleteCompanyLogo]);

  const initials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild><Link href="/dashboard/instructors"><ArrowLeft className="mr-2 h-4 w-4" />Back to Instructors</Link></Button>
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Instructor not found.</p></CardContent></Card>
      </div>
    );
  }

  const socialLinks = socials
    ? Object.entries({
        LinkedIn: socials.linkedinUrl,
        Twitter: socials.twitterUrl,
        YouTube: socials.youtubeUrl,
        GitHub: socials.githubUrl,
        Website: socials.websiteUrl,
        Facebook: socials.facebookUrl,
        Instagram: socials.instagramUrl,
      }).filter(([, v]) => v)
    : [];

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Button variant="ghost" asChild>
        <Link href="/dashboard/instructors"><ArrowLeft className="mr-2 h-4 w-4" />Back to Instructors</Link>
      </Button>

      {/* Profile header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <InstructorPhotoUploader
              currentImageUrl={instructor.profileUrl}
              onUpload={handleUploadProfilePhoto}
              onDelete={handleDeleteProfilePhoto}
              isUploading={uploadProfilePhoto.isPending}
              isDeleting={deleteProfilePhoto.isPending}
              shape="circle"
              size={80}
              fallbackInitials={initials(instructor.name)}
            />
            <div className="flex-1">
              <CardTitle className="text-2xl">{instructor.name}</CardTitle>
              <CardDescription>{instructor.email || "No email"}</CardDescription>
              {instructor.expertise && <Badge variant="secondary" className="mt-2">{instructor.expertise}</Badge>}
              {instructor.bio && <p className="text-muted-foreground mt-3 text-sm">{instructor.bio}</p>}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Experiences */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Work Experience</CardTitle>
            <CardDescription>Professional background and experience</CardDescription>
          </div>
          <Button size="sm" onClick={openAddExp}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </CardHeader>
        <CardContent>
          {(!experiences || experiences.length === 0) ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No experience entries yet.</p>
          ) : (
            <div className="space-y-4">
              {experiences.map((exp) => (
                <div key={exp.id} className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {exp.companyLogo ? (
                      <Image src={exp.companyLogo} alt={exp.company} width={40} height={40} className="h-full w-full object-contain" unoptimized />
                    ) : (
                      <Briefcase className="text-muted-foreground h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{exp.company}</span>
                      <Badge variant="outline" className="text-xs">{exp.years} yr{exp.years !== 1 ? "s" : ""}</Badge>
                    </div>
                    {exp.details && <p className="text-muted-foreground mt-1 text-sm">{exp.details}</p>}
                    <div className="mt-2">
                      <InstructorPhotoUploader
                        currentImageUrl={exp.companyLogo}
                        onUpload={(file) => handleUploadCompanyLogo(exp.id, file)}
                        onDelete={() => handleDeleteCompanyLogo(exp.id)}
                        isUploading={uploadCompanyLogo.isPending}
                        isDeleting={deleteCompanyLogo.isPending}
                        shape="rect"
                        size={48}
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditExp(exp)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => setDeleteExpId(exp.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Socials */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Social Links</CardTitle>
            <CardDescription>Online presence and profiles</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={openSocialsEdit}><Edit className="mr-1 h-4 w-4" />Edit</Button>
        </CardHeader>
        <CardContent>
          {socialLinks.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No social links added yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {socialLinks.map(([label, url]) => (
                <a key={label} href={url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{label}</span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Experience Add/Edit Dialog */}
      <Dialog open={isExpDialogOpen} onOpenChange={(open) => { if (!open) { setIsExpDialogOpen(false); resetExpForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExp ? "Edit Experience" : "Add Experience"}</DialogTitle>
            <DialogDescription>Professional work experience entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={expCompany} onChange={(e) => setExpCompany(e.target.value)} placeholder="e.g., Google" />
            </div>
            <div className="space-y-2">
              <Label>Years</Label>
              <Input type="number" value={expYears} onChange={(e) => setExpYears(e.target.value)} placeholder="e.g., 3" min="0" />
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea value={expDetails} onChange={(e) => setExpDetails(e.target.value)} placeholder="Role description, achievements..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsExpDialogOpen(false); resetExpForm(); }}>Cancel</Button>
            <Button onClick={handleSaveExp} disabled={!expCompany.trim() || !expYears || createExperience.isPending || updateExperience.isPending}>
              {(createExperience.isPending || updateExperience.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingExp ? "Save Changes" : "Add Experience"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Experience Delete Confirmation */}
      <AlertDialog open={!!deleteExpId} onOpenChange={(open) => !open && setDeleteExpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Experience</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to remove this experience entry?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExp} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteExperience.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Socials Edit Dialog */}
      <Dialog open={isSocialsOpen} onOpenChange={setIsSocialsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Social Links</DialogTitle>
            <DialogDescription>Update the instructor&apos;s social media profiles.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {[
              { label: "LinkedIn", value: sLinkedin, set: setSLinkedin, placeholder: "https://linkedin.com/in/..." },
              { label: "Twitter / X", value: sTwitter, set: setSTwitter, placeholder: "https://twitter.com/..." },
              { label: "YouTube", value: sYoutube, set: setSYoutube, placeholder: "https://youtube.com/..." },
              { label: "GitHub", value: sGithub, set: setSGithub, placeholder: "https://github.com/..." },
              { label: "Website", value: sWebsite, set: setSWebsite, placeholder: "https://..." },
              { label: "Facebook", value: sFacebook, set: setSFacebook, placeholder: "https://facebook.com/..." },
              { label: "Instagram", value: sInstagram, set: setSInstagram, placeholder: "https://instagram.com/..." },
            ].map((field) => (
              <div key={field.label} className="space-y-1">
                <Label className="text-xs">{field.label}</Label>
                <Input value={field.value} onChange={(e) => field.set(e.target.value)} placeholder={field.placeholder} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSocialsOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSocials} disabled={upsertSocials.isPending}>
              {upsertSocials.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Social Links
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
