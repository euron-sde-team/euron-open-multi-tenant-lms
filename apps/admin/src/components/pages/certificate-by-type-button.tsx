"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useToast,
} from "@open-mtlms/core";
import { BookOpen, ClipboardCheck, Loader2, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { CertificateAssignmentModal } from "./certificate-assignment-modal";
import type { CertOfferingType, CertificateAssignment } from "@/lib/api/certificate-assignments";
import {
  useCertificateAssignments,
  useClearCertificateAssignment,
} from "@/lib/hooks/use-certificate-assignments";

const OFFERINGS: { type: CertOfferingType; label: string; icon: typeof BookOpen }[] = [
  { type: "COURSE", label: "Courses", icon: BookOpen },
  { type: "TEST_SERIES", label: "Test Series", icon: ClipboardCheck },
];

function designLabel(a: CertificateAssignment | undefined): string {
  if (!a) return "Using default certificate";
  if (a.certificateTemplateId) return a.certificateTemplateName || "Custom design";
  if (a.presetTemplate) return a.presetTemplate.replace(/-/g, " ");
  return "Using default certificate";
}

/**
 * "Configure" button + dialog for per-offering-type certificate assignment,
 * for embedding next to "Design certificate" on the Pages certificate card.
 * Same behavior as the settings/certificates "Certificate by type" section.
 */
export function CertificateByTypeButton({ className }: { className?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<CertOfferingType | null>(null);

  const { data: assignments } = useCertificateAssignments();
  const clearAssignment = useClearCertificateAssignment();

  const byType = (type: CertOfferingType) => assignments?.find((a) => a.offeringType === type);

  const handleReset = (type: CertOfferingType, label: string) => {
    clearAssignment.mutate(type, {
      onSuccess: () =>
        toast({ title: `${label} reset to default`, description: `${label} will use the default certificate.` }),
      onError: (error) =>
        toast({
          title: "Could not reset",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        }),
    });
  };

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)}>
        <SlidersHorizontal className="mr-2 h-4 w-4" />
        Configure
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Certificate by type</DialogTitle>
            <DialogDescription>
              Give courses and test series different certificates. If a type isn&rsquo;t set, the
              default design is used.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y">
            {OFFERINGS.map(({ type, label, icon: Icon }) => {
              const assignment = byType(type);
              const isSet = assignment?.source === "assigned";
              return (
                <div key={type} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-muted-foreground text-xs capitalize">
                        {isSet ? designLabel(assignment) : "Using default certificate"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isSet && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReset(type, label)}
                        disabled={clearAssignment.isPending}
                      >
                        {clearAssignment.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Reset
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setPickerFor(type)}>
                      Choose design
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {OFFERINGS.map(({ type, label }) => {
        const assignment = byType(type);
        return (
          <CertificateAssignmentModal
            key={type}
            open={pickerFor === type}
            onOpenChange={(o) => setPickerFor(o ? type : null)}
            offeringType={type}
            offeringLabel={label}
            current={{
              presetTemplate: assignment?.source === "assigned" ? assignment.presetTemplate : null,
              certificateTemplateId:
                assignment?.source === "assigned" ? assignment.certificateTemplateId : null,
            }}
          />
        );
      })}
    </>
  );
}
