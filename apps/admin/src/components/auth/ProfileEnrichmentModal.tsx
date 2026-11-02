"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
  Input,
} from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@open-mtlms/shared";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { authApi } from "@/lib/api/auth";
import { authKeys } from "@/lib/hooks/use-auth";

function extractApiError(err: unknown, fallback: string): string {
  const msg = getErrorMessage(err);
  return msg === "An error occurred" ? fallback : msg;
}

interface ProfileEnrichmentModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileEnrichmentModal({ open, onClose }: ProfileEnrichmentModalProps) {
  const queryClient = useQueryClient();

  const [designation, setDesignation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designation.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      await authApi.updateProfile({ designation: designation.trim() });
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
      onClose();
    } catch (err) {
      setError(extractApiError(err, "Failed to save profile. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Tell us a bit about yourself. You can always update this later.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="designation">Your Role / Designation</Label>
            <Input
              id="designation"
              placeholder="e.g. Founder, Instructor, Marketing Manager"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading || !designation.trim()}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & Continue
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
