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
  useToast,
} from "@open-mtlms/core";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCreateMember } from "../../lib/hooks/use-members";

interface AddUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d][\d\s()-]{4,}$/;

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Failed to add user";
}

export function AddUserModal({ open, onOpenChange }: AddUserModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const createMember = useCreateMember();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!trimmedEmail && !trimmedPhone) {
      setError("Provide at least an email or a phone number.");
      return;
    }
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
      setError("Please enter a valid phone number.");
      return;
    }

    createMember.mutate(
      {
        name: trimmedName,
        email: trimmedEmail || undefined,
        phone: trimmedPhone || undefined,
      },
      {
        onSuccess: (member) => {
          toast({
            title: "User added",
            description: `${member.name} has been added to your members.`,
          });
          handleOpenChange(false);
          // Drop the admin straight into the new user's detail page, as if
          // they had clicked the user in the list.
          router.push(`/dashboard/users/${member.id}`);
        },
        onError: (err) => {
          setError(getErrorMessage(err));
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            Manually onboard a single member. Name is required, plus at least
            one of email or phone. The user signs in via the normal
            password-reset or OTP flow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="add-user-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              autoFocus
              disabled={createMember.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-user-email">Email</Label>
            <Input
              id="add-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              disabled={createMember.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-user-phone">Phone</Label>
            <Input
              id="add-user-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              disabled={createMember.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createMember.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMember.isPending}>
              {createMember.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
