"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useToast,
} from "@open-mtlms/core";
import { Camera, CheckCircle2, Loader2, Lock, Trash2 } from "lucide-react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { authApi } from "@/lib/api/auth";
import { OtpForm } from "@/components/auth/otp-form";
import { PhoneInput } from "@/components/auth/phone-input";
import {
  authKeys,
  useAuth,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from "@/lib/hooks/use-auth";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Avatar section                                                      */
/* ------------------------------------------------------------------ */

function AvatarSection() {
  const { user } = useAuth();
  const uploadMutation = useUploadAvatar();
  const removeMutation = useRemoveAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState(false);

  const avatarUrl =
    user && "avatar_url" in user
      ? (user as { avatar_url?: string | null }).avatar_url
      : null;
  const hasAvatar = !!avatarUrl && !avatarError;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(false);
    uploadMutation.mutate(file);
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const initials = (() => {
    const name = user?.name;
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  return (
    <div className="flex items-center gap-6">
      <div
        className={cn(
          "relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full overflow-hidden",
          !hasAvatar && "bg-primary/10"
        )}
      >
        {hasAvatar ? (
          <Image
            src={avatarUrl!}
            alt={user?.name || "Avatar"}
            width={80}
            height={80}
            className="h-full w-full object-cover"
            onError={() => setAvatarError(true)}
            unoptimized
          />
        ) : (
          <span className="text-xl font-semibold text-primary">{initials}</span>
        )}
        {(uploadMutation.isPending || removeMutation.isPending) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <Camera className="mr-2 h-4 w-4" />
          {hasAvatar ? "Change Photo" : "Upload Photo"}
        </Button>
        {hasAvatar && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          JPG, PNG, or WebP. Max 5 MB.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phone change dialog (closeable, reuses PhoneInput + OtpForm)        */
/* ------------------------------------------------------------------ */

function ChangePhoneDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone) return;
    setIsLoading(true);
    setError("");
    try {
      await authApi.sendVerifyPhoneOtp(phone);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setIsLoading(true);
    setError("");
    try {
      await authApi.verifyPhone({ phone, code });
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
      onOpenChange(false);
      // Reset state for next open
      setStep("phone");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setStep("phone");
          setPhone("");
          setError("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Phone Number</DialogTitle>
          <DialogDescription>
            {step === "phone"
              ? "Enter your new phone number. We'll send an OTP via WhatsApp."
              : `Enter the OTP sent to ${phone} via WhatsApp.`}
          </DialogDescription>
        </DialogHeader>

        {step === "phone" ? (
          <>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <PhoneInput
                  value={phone}
                  onChange={(value) => {
                    setPhone(value ?? "");
                    setError("");
                  }}
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !phone}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send OTP via WhatsApp
              </Button>
            </form>
          </>
        ) : (
          <OtpForm
            identifier={phone}
            channel="whatsapp"
            onVerify={handleVerifyOtp}
            onBack={() => {
              setStep("phone");
              setError("");
            }}
            onResend={() => authApi.sendVerifyPhoneOtp(phone)}
            isLoading={isLoading}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile form                                                        */
/* ------------------------------------------------------------------ */

function ProfileForm() {
  const { user } = useAuth();
  const updateMutation = useUpdateProfile();
  const { toast } = useToast();
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);

  // useAuth returns User | UserProfile, only UserProfile has profile fields
  const profile =
    user && "designation" in user
      ? (user as unknown as {
          name: string;
          email: string;
          phone: string | null;
          phone_verified: boolean;
          designation: string | null;
        })
      : null;

  const [name, setName] = useState(profile?.name ?? "");
  const [designation, setDesignation] = useState(profile?.designation ?? "");

  // Sync form when profile data loads/changes
  const nameRef = useRef(profile?.name);
  if (profile?.name && profile.name !== nameRef.current) {
    nameRef.current = profile.name;
    setName(profile.name);
  }
  const designationRef = useRef(profile?.designation);
  if (profile?.designation !== designationRef.current) {
    designationRef.current = profile?.designation ?? null;
    setDesignation(profile?.designation ?? "");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    updateMutation.mutate(
      { name: name.trim(), designation: designation.trim() || undefined },
      {
        onSuccess: () => {
          toast({ title: "Profile updated" });
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to update profile",
            variant: "destructive",
          });
        },
      }
    );
  };

  const isDirty =
    name.trim() !== (profile?.name ?? "") ||
    (designation.trim() || "") !== (profile?.designation ?? "");

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input
              id="email"
              value={profile?.email ?? ""}
              disabled
              className="pr-10"
            />
            <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Email cannot be changed
          </p>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label>Phone</Label>
          <div className="flex items-center gap-3">
            {profile?.phone ? (
              <div className="flex items-center gap-2">
                <span className="text-sm">{profile.phone}</span>
                {profile.phone_verified && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                No phone number added
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPhoneDialog(true)}
            >
              {profile?.phone ? "Change" : "Add Phone"}
            </Button>
          </div>
        </div>

        {/* Designation */}
        <div className="space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Input
            id="designation"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Product Manager"
          />
        </div>

        {/* Save */}
        <Button
          type="submit"
          disabled={updateMutation.isPending || !isDirty || !name.trim()}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </form>

      <ChangePhoneDialog
        open={showPhoneDialog}
        onOpenChange={setShowPhoneDialog}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your personal information and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Photo</CardTitle>
          <CardDescription>
            Your profile photo is visible to your team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarSection />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
          <CardDescription>
            Update your name and contact details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm />
        </CardContent>
      </Card>
    </div>
  );
}
