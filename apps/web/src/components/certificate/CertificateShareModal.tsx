"use client";

import { Check, Copy, LinkedinIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface CertificateShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificateNumber: string;
  courseTitle: string;
  tenantName: string;
  issuedAt: string;
  verifyUrl: string;
}

function buildLinkedInAddToProfileUrl(p: {
  certificateNumber: string;
  courseTitle: string;
  tenantName: string;
  issuedAt: string;
  verifyUrl: string;
}): string {
  const url = new URL("https://www.linkedin.com/profile/add");
  url.searchParams.set("startTask", "CERTIFICATION_NAME");
  url.searchParams.set("name", p.courseTitle);
  url.searchParams.set("organizationName", p.tenantName);
  const d = new Date(p.issuedAt);
  if (!Number.isNaN(d.getTime())) {
    url.searchParams.set("issueYear", String(d.getUTCFullYear()));
    url.searchParams.set("issueMonth", String(d.getUTCMonth() + 1));
  }
  url.searchParams.set("certUrl", p.verifyUrl);
  url.searchParams.set("certId", p.certificateNumber);
  return url.toString();
}

export function CertificateShareModal({
  open,
  onOpenChange,
  certificateNumber,
  courseTitle,
  tenantName,
  issuedAt,
  verifyUrl,
}: CertificateShareModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({
        title: "Copied",
        description: "Certificate link copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Long-press the link to copy it manually.",
        variant: "destructive",
      });
    }
  };

  const handleLinkedIn = () => {
    const url = buildLinkedInAddToProfileUrl({
      certificateNumber,
      courseTitle,
      tenantName,
      issuedAt,
      verifyUrl,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share certificate</DialogTitle>
          <DialogDescription>
            Copy the verifiable link or add this credential to your LinkedIn profile in one click.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cert-share-link">Shareable link</Label>
            <div className="flex gap-2">
              <Input
                id="cert-share-link"
                readOnly
                value={verifyUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="mr-1 h-4 w-4 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleLinkedIn}
            className="w-full bg-[#0A66C2] text-white hover:bg-[#004182]"
          >
            <LinkedinIcon className="mr-2 h-4 w-4" />
            Share on LinkedIn
          </Button>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            LinkedIn will open with the certificate name, issuing organization, and date prefilled. Confirm the details and tap Save to add it to your profile.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
