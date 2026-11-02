"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from "@open-mtlms/core";
import { LogIn } from "lucide-react";

interface LoginPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginPromptModal({ open, onOpenChange }: LoginPromptModalProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-center">
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>
            Sign in to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={() => {
              onOpenChange(false);
              router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            }}
            className="w-full"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Button>
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
