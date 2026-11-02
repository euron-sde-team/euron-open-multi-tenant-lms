"use client";

import {
  CertificateRenderer,
  ConfigCertificateRenderer,
  CERTIFICATE_PAGE_DIMENSIONS,
  useCertificateFonts,
  type CertificateData,
  type CertificateDesign,
} from "@open-mtlms/certificate-templates";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
  useToast,
} from "@open-mtlms/core";
import { Award, Check, Loader2, PenTool } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { CertOfferingType } from "@/lib/api/certificate-assignments";
import { rowToDesign } from "@/lib/certificate-design";
import { useSetCertificateAssignment } from "@/lib/hooks/use-certificate-assignments";
import { useCertificateDesigns } from "@/lib/hooks/use-certificate-designer";
import { useCertificateTemplates } from "@/lib/hooks/use-certificate-templates";
import { useOrgDetails } from "@/lib/hooks/use-tenant-org";

interface CertificateAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offeringType: CertOfferingType;
  offeringLabel: string;
  current: {
    presetTemplate: string | null;
    certificateTemplateId: string | null;
  };
}

// A selection is either a preset id or a custom design id.
type Selection = { kind: "preset" | "custom"; id: string } | null;

const CERT_WIDTH = 1122;
const CERT_HEIGHT = 793;
// Width the preview column renders at (scaled down from native 1122px).
const PREVIEW_WIDTH = 440;

/** Sample data so the preview shows filled-in tokens (matches the global modal). */
function buildSampleData(
  offeringLabel: string,
  directorName: string,
  directorTitle: string,
): CertificateData {
  return {
    certificateNumber: "CERT-XXXX-XXXX",
    courseTitle:
      offeringLabel === "Test Series" ? "Full Stack Test Series" : "Advanced React Development",
    firstName: "Student",
    lastName: "Name",
    formattedIssuedAt: "January 1, 2026",
    directorName,
    directorTitle,
    logoUrl: undefined,
    verifyUrl: "https://example.com/certificate/CERT-XXXX-XXXX",
    testSeriesTitle: "Full Stack Test Series",
    hoursText: "12 hours",
    lessonsCompleted: 24,
    quizzesPassed: 6,
    finalScore: "88%",
    expiryText: "January 1, 2028",
    tenantName: directorName,
  };
}

/** Scale a custom (config) design to fit the preview column width. */
function ScaledConfigCertificate({
  design,
  data,
}: {
  design: CertificateDesign;
  data: CertificateData;
}) {
  const dims = CERTIFICATE_PAGE_DIMENSIONS[design.page.size][design.page.orientation];
  const scale = PREVIEW_WIDTH / dims.width;
  return (
    <div style={{ width: dims.width * scale, height: dims.height * scale }}>
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: dims.width,
          height: dims.height,
        }}
      >
        <ConfigCertificateRenderer design={design} data={data} />
      </div>
    </div>
  );
}

/** Scale a preset (native 1122x793) to fit the preview column width. */
function ScaledPresetCertificate({
  templateId,
  data,
}: {
  templateId: string;
  data: CertificateData;
}) {
  const scale = PREVIEW_WIDTH / CERT_WIDTH;
  return (
    <div style={{ width: CERT_WIDTH * scale, height: CERT_HEIGHT * scale }}>
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: CERT_WIDTH,
          height: CERT_HEIGHT,
        }}
      >
        <CertificateRenderer templateId={templateId} data={data} />
      </div>
    </div>
  );
}

export function CertificateAssignmentModal({
  open,
  onOpenChange,
  offeringType,
  offeringLabel,
  current,
}: CertificateAssignmentModalProps) {
  const { toast } = useToast();
  useCertificateFonts();
  const { data: presetsData, isLoading: presetsLoading } = useCertificateTemplates();
  const { data: customDesigns, isLoading: customLoading } = useCertificateDesigns();
  const { data: orgDetails } = useOrgDetails();
  const setAssignment = useSetCertificateAssignment();

  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    if (!open) return;
    if (current.certificateTemplateId) {
      setSelection({ kind: "custom", id: current.certificateTemplateId });
    } else if (current.presetTemplate) {
      setSelection({ kind: "preset", id: current.presetTemplate });
    } else {
      setSelection(null);
    }
  }, [open, current.presetTemplate, current.certificateTemplateId]);

  const presets = (presetsData?.templates ?? []).filter((t) => t.available);
  const designs = customDesigns ?? [];
  const isLoading = presetsLoading || customLoading;

  const sampleData = useMemo(
    () =>
      buildSampleData(
        offeringLabel,
        orgDetails?.founderName || "Your Organization",
        (orgDetails?.founderTitle ?? "").trim() || "Director",
      ),
    [offeringLabel, orgDetails?.founderName, orgDetails?.founderTitle],
  );

  // The design currently highlighted for preview.
  const selectedCustom =
    selection?.kind === "custom" ? designs.find((d) => d.id === selection.id) : null;
  const selectedPreset =
    selection?.kind === "preset" ? presets.find((p) => p.id === selection.id) : null;

  const handleSave = () => {
    if (!selection) return;
    setAssignment.mutate(
      {
        offeringType,
        input:
          selection.kind === "preset"
            ? { presetTemplate: selection.id }
            : { certificateTemplateId: selection.id },
      },
      {
        onSuccess: () => {
          toast({
            title: `${offeringLabel} certificate updated`,
            description: `New ${offeringLabel.toLowerCase()} certificates will use this design.`,
          });
          onOpenChange(false);
        },
        onError: (error) => {
          toast({
            title: "Could not save certificate design",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const isSelected = (kind: "preset" | "custom", id: string) =>
    selection?.kind === kind && selection.id === id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle>{offeringLabel} certificate design</DialogTitle>
          <DialogDescription>
            Choose a preset or one of your custom designs for {offeringLabel.toLowerCase()}{" "}
            certificates. This overrides the default certificate for this type.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Left: live preview of the highlighted design */}
            <div className="flex flex-col gap-3 border-b px-6 py-6 lg:border-b-0 lg:border-r">
              <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-4 dark:from-gray-900 dark:to-gray-800">
                {selectedCustom ? (
                  <ScaledConfigCertificate design={rowToDesign(selectedCustom)} data={sampleData} />
                ) : selectedPreset ? (
                  <ScaledPresetCertificate templateId={selectedPreset.id} data={sampleData} />
                ) : (
                  <p className="text-muted-foreground py-12 text-sm">
                    Select a design to preview
                  </p>
                )}
              </div>
              {(selectedCustom || selectedPreset) && (
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">
                    {selectedCustom?.name ?? selectedPreset?.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {selectedCustom
                      ? "Your custom design"
                      : "Preset design"}
                  </p>
                </div>
              )}
            </div>

            {/* Right: selectable list */}
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {designs.length > 0 && (
                  <div>
                    <h4 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                      <PenTool className="h-3.5 w-3.5" /> Your designs
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {designs.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setSelection({ kind: "custom", id: d.id })}
                          className={cn(
                            "relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                            isSelected("custom", d.id)
                              ? "border-primary bg-primary/5 ring-primary/20 ring-1"
                              : "hover:bg-muted/50",
                          )}
                        >
                          {isSelected("custom", d.id) && (
                            <Check className="text-primary absolute right-2 top-2 h-4 w-4" />
                          )}
                          <span className="line-clamp-1 text-sm font-medium">{d.name}</span>
                          <span className="text-muted-foreground text-xs capitalize">
                            {d.page_size} · {d.orientation.toLowerCase()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                    <Award className="h-3.5 w-3.5" /> Presets
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelection({ kind: "preset", id: t.id })}
                        className={cn(
                          "relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                          isSelected("preset", t.id)
                            ? "border-primary bg-primary/5 ring-primary/20 ring-1"
                            : "hover:bg-muted/50",
                        )}
                      >
                        {isSelected("preset", t.id) && (
                          <Check className="text-primary absolute right-2 top-2 h-4 w-4" />
                        )}
                        <span className="line-clamp-1 text-sm font-medium">{t.name}</span>
                        <span className="text-muted-foreground line-clamp-1 text-xs">
                          {t.previewLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selection || setAssignment.isPending}>
            {setAssignment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
