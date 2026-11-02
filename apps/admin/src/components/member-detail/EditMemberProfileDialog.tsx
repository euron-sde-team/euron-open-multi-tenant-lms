"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  useToast,
} from "@open-mtlms/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/lib/api/axios";
import { useUpdateMemberProfile } from "@/lib/hooks/use-members";
import type { MemberDetail } from "@/lib/types/members";

const editSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200, "Too long"),
    email: z
      .string()
      .trim()
      .max(320, "Too long")
      .refine(
        (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        "Invalid email format"
      ),
    phone: z
      .string()
      .trim()
      .max(32, "Too long")
      .refine(
        (v) => v === "" || /^[+\d][\d\s()-]{4,}$/.test(v),
        "Invalid phone format"
      ),
    keepEmailVerified: z.boolean(),
    keepPhoneVerified: z.boolean(),
  })
  .refine(
    (data) => data.email.trim() !== "" || data.phone.trim() !== "",
    {
      message: "At least one of email or phone must be set",
      path: ["email"],
    }
  );

type EditForm = z.infer<typeof editSchema>;

interface EditMemberProfileDialogProps {
  member: MemberDetail;
  isOpen: boolean;
  onClose: () => void;
}

type Step = "form" | "confirm";

export function EditMemberProfileDialog({
  member,
  isOpen,
  onClose,
}: EditMemberProfileDialogProps) {
  const { toast } = useToast();
  const updateProfile = useUpdateMemberProfile();
  const [step, setStep] = useState<Step>("form");

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: member.name,
      email: member.email ?? "",
      phone: member.phone ?? "",
      keepEmailVerified: false,
      keepPhoneVerified: false,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (isOpen) {
      reset({
        name: member.name,
        email: member.email ?? "",
        phone: member.phone ?? "",
        keepEmailVerified: false,
        keepPhoneVerified: false,
      });
      setStep("form");
    }
  }, [isOpen, member, reset]);

  const watched = watch();
  const emailChanged =
    watched.email.trim().toLowerCase() !== (member.email ?? "").toLowerCase();
  const phoneChanged = watched.phone.trim() !== (member.phone ?? "");
  const nameChanged = watched.name.trim() !== member.name;
  const hasChanges = nameChanged || emailChanged || phoneChanged;

  const handleFormSubmit = handleSubmit(() => {
    if (!hasChanges) {
      toast({ title: "No changes to save" });
      return;
    }
    setStep("confirm");
  });

  const handleConfirm = () => {
    const values = form.getValues();
    const input = {
      name: nameChanged ? values.name.trim() : undefined,
      email: emailChanged
        ? values.email.trim() === ""
          ? null
          : values.email.trim().toLowerCase()
        : undefined,
      phone: phoneChanged
        ? values.phone.trim() === ""
          ? null
          : values.phone.trim()
        : undefined,
      keepEmailVerified:
        emailChanged && member.email_verified
          ? values.keepEmailVerified
          : undefined,
      keepPhoneVerified:
        phoneChanged && member.phone_verified
          ? values.keepPhoneVerified
          : undefined,
    };

    updateProfile.mutate(
      { memberId: member.id, input },
      {
        onSuccess: () => {
          toast({
            title: "Profile updated",
            description: "Member details saved successfully.",
          });
          onClose();
        },
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to update profile";

          if (err instanceof ApiError && err.status === 409) {
            const lower = message.toLowerCase();
            const field = lower.includes("email")
              ? "email"
              : lower.includes("phone")
                ? "phone"
                : null;
            if (field) {
              setError(field, { type: "server", message });
              setStep("form");
              return;
            }
          }

          toast({
            title: "Update failed",
            description: message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !updateProfile.isPending) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit member profile</DialogTitle>
              <DialogDescription>
                Update this member&apos;s identifying details. Use this only
                when you have a legitimate reason to make the change on their
                behalf.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleFormSubmit}
              className="space-y-4"
              id="edit-member-profile-form"
            >
              <div className="space-y-1.5">
                <Label htmlFor="member-name">Name</Label>
                <Input id="member-name" {...register("name")} />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="member-email">Email</Label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="leave blank to clear"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
                {emailChanged && member.email_verified && (
                  <div className="flex items-center justify-between rounded-md border border-muted p-2 pl-3">
                    <span className="text-xs text-muted-foreground">
                      Keep as verified
                    </span>
                    <Switch
                      checked={watched.keepEmailVerified}
                      onCheckedChange={(checked) =>
                        form.setValue("keepEmailVerified", checked)
                      }
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="member-phone">Phone</Label>
                <Input
                  id="member-phone"
                  placeholder="leave blank to clear"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">
                    {errors.phone.message}
                  </p>
                )}
                {phoneChanged && member.phone_verified && (
                  <div className="flex items-center justify-between rounded-md border border-muted p-2 pl-3">
                    <span className="text-xs text-muted-foreground">
                      Keep as verified
                    </span>
                    <Switch
                      checked={watched.keepPhoneVerified}
                      onCheckedChange={(checked) =>
                        form.setValue("keepPhoneVerified", checked)
                      }
                    />
                  </div>
                )}
              </div>
            </form>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-member-profile-form"
                disabled={!hasChanges}
              >
                Save changes
              </Button>
            </DialogFooter>
          </>
        ) : (
          <ConfirmStep
            member={member}
            emailChanged={emailChanged}
            phoneChanged={phoneChanged}
            nameChanged={nameChanged}
            keepEmailVerified={watched.keepEmailVerified}
            keepPhoneVerified={watched.keepPhoneVerified}
            newEmail={watched.email.trim() === "" ? null : watched.email.trim()}
            newPhone={watched.phone.trim() === "" ? null : watched.phone.trim()}
            isPending={updateProfile.isPending}
            onBack={() => setStep("form")}
            onConfirm={handleConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmStepProps {
  member: MemberDetail;
  nameChanged: boolean;
  emailChanged: boolean;
  phoneChanged: boolean;
  keepEmailVerified: boolean;
  keepPhoneVerified: boolean;
  newEmail: string | null;
  newPhone: string | null;
  isPending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

function ConfirmStep({
  member,
  nameChanged,
  emailChanged,
  phoneChanged,
  keepEmailVerified,
  keepPhoneVerified,
  newEmail,
  newPhone,
  isPending,
  onBack,
  onConfirm,
}: ConfirmStepProps) {
  const willResetEmailVerified =
    emailChanged && member.email_verified && !keepEmailVerified;
  const willResetPhoneVerified =
    phoneChanged && member.phone_verified && !keepPhoneVerified;

  return (
    <>
      <DialogHeader>
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <DialogTitle className="text-center">
          Confirm identity edit
        </DialogTitle>
        <DialogDescription className="text-center">
          You are editing identifying information for{" "}
          <span className="font-medium text-foreground">{member.name}</span>.
          Review the impact below before saving.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 rounded-md border p-4 text-sm">
        <p className="text-muted-foreground">What will happen:</p>
        <ul className="space-y-1.5 pl-4 text-muted-foreground">
          {nameChanged && (
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              The member&apos;s displayed name will change.
            </li>
          )}
          {emailChanged && (
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              The member will need to use{" "}
              <span className="font-medium text-foreground">
                {newEmail ?? "no email"}
              </span>{" "}
              to log in via email.
            </li>
          )}
          {phoneChanged && (
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              The member will need to use{" "}
              <span className="font-medium text-foreground">
                {newPhone ?? "no phone"}
              </span>{" "}
              for OTP and contact.
            </li>
          )}
          {willResetEmailVerified && (
            <li className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              The email verification status will reset to unverified.
            </li>
          )}
          {willResetPhoneVerified && (
            <li className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              The phone verification status will reset to unverified.
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
            Enrollments, orders and progress remain untouched.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            Changes apply immediately across the platform.
          </li>
        </ul>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending && (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          )}
          I understand, save changes
        </Button>
      </DialogFooter>
    </>
  );
}
