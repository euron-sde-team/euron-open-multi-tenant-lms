"use client";

import { Button, Card, CardContent, Switch, useToast } from "@open-mtlms/core";
import { Award, BookOpen, ClipboardCheck, Loader2, PenTool } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CertificateAssignmentModal, CertificateTemplateModal } from "@/components/pages";
import type { CertOfferingType, CertificateAssignment } from "@/lib/api/certificate-assignments";
import {
  useCertificateAssignments,
  useClearCertificateAssignment,
} from "@/lib/hooks/use-certificate-assignments";
import {
  useCertificatesSettings,
  useUpdateCertificatesSettings,
} from "@/lib/hooks/use-certificates-settings";

const OFFERINGS: { type: CertOfferingType; label: string; icon: typeof BookOpen }[] = [
  { type: "COURSE", label: "Courses", icon: BookOpen },
  { type: "TEST_SERIES", label: "Test Series", icon: ClipboardCheck },
];

/** Human label for the design currently in effect for an offering type. */
function designLabel(a: CertificateAssignment | undefined): string {
  if (!a) return "Using default certificate";
  if (a.certificateTemplateId) return a.certificateTemplateName || "Custom design";
  if (a.presetTemplate) return a.presetTemplate.replace(/-/g, " ");
  return "Using default certificate";
}

export default function CertificatesSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useCertificatesSettings();
  const updateSettings = useUpdateCertificatesSettings();
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const { data: assignments } = useCertificateAssignments();
  const clearAssignment = useClearCertificateAssignment();
  // Which offering type's picker is open (null = closed).
  const [pickerFor, setPickerFor] = useState<CertOfferingType | null>(null);

  const assignmentByType = (type: CertOfferingType) =>
    assignments?.find((a) => a.offeringType === type);

  const handleReset = (type: CertOfferingType, label: string) => {
    clearAssignment.mutate(type, {
      onSuccess: () =>
        toast({
          title: `${label} reset to default`,
          description: `${label} will use the default certificate.`,
        }),
      onError: (error) =>
        toast({
          title: "Could not reset",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        }),
    });
  };

  // Default ON: when unset/loading, treat certificates as enabled.
  const certificatesEnabled = settings?.certificate_tab_enabled ?? true;

  const handleToggle = (enabled: boolean) => {
    updateSettings.mutate(
      { certificate_tab_enabled: enabled },
      {
        onSuccess: () => {
          toast({
            title: enabled ? "Certificates enabled" : "Certificates disabled",
            description: enabled
              ? "Learners can now see the Certificates tab in their profile."
              : "The Certificates tab is now hidden from learners' profiles.",
          });
        },
        onError: (error) => {
          toast({
            title: "Could not update certificate settings",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Manage Certificates</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Control whether learners can access certificates and choose your certificate design.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Certificates in learner profile</h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      When enabled, learners see a &ldquo;Certificates&rdquo; tab in their
                      profile where they can view and download earned certificates. Disable
                      this to hide the tab entirely from every learner&rsquo;s profile.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={certificatesEnabled}
                  onCheckedChange={handleToggle}
                  disabled={updateSettings.isPending}
                  aria-label="Certificates in learner profile"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Default certificate design</h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      The certificate used for any offering that doesn&rsquo;t have its own
                      design set below. Pick a preset or create a custom design.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => setIsTemplateModalOpen(true)}
                  >
                    <Award className="mr-2 h-4 w-4" />
                    Presets
                  </Button>
                  <Link
                    href="/dashboard/settings/certificates/designer"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
                  >
                    <PenTool className="mr-2 h-4 w-4" />
                    Design certificate
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-offering-type design assignment. Each type falls back to the
              default above when not set. */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold">Certificate by type</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  Give courses and test series different certificates. If a type isn&rsquo;t
                  set, the default design above is used.
                </p>
              </div>

              <div className="divide-y">
                {OFFERINGS.map(({ type, label, icon: Icon }) => {
                  const assignment = assignmentByType(type);
                  const isSet = assignment?.source === "assigned";
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
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
                            Reset to default
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPickerFor(type)}
                        >
                          Choose design
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <CertificateTemplateModal
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
      />

      {OFFERINGS.map(({ type, label }) => {
        const assignment = assignmentByType(type);
        return (
          <CertificateAssignmentModal
            key={type}
            open={pickerFor === type}
            onOpenChange={(o) => setPickerFor(o ? type : null)}
            offeringType={type}
            offeringLabel={label}
            current={{
              // Only pre-select when a per-type row is actually set (not the
              // inherited default), so "Choose design" starts from the type's
              // own choice.
              presetTemplate:
                assignment?.source === "assigned" ? assignment.presetTemplate : null,
              certificateTemplateId:
                assignment?.source === "assigned" ? assignment.certificateTemplateId : null,
            }}
          />
        );
      })}
    </div>
  );
}
