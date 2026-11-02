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
  useToast,
} from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Upload, X } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";

import type { CertificateTemplateRow } from "@/lib/api/certificate-designer";
import type { CertificateTemplateInfo } from "@/lib/api/certificate-templates";
import { uploadApi } from "@/lib/api/upload";
import {
  certificateDesignerKeys,
  useCertificateDesigns,
  useSetDefaultCertificateDesign,
} from "@/lib/hooks/use-certificate-designer";
import {
  useCertificateTemplates,
  useSelectCertificateTemplate,
  useSelectedCertificateTemplate,
} from "@/lib/hooks/use-certificate-templates";
import { useOrgDetails } from "@/lib/hooks/use-tenant-org";
import { useTenantStore } from "@/lib/stores/tenant-store";

interface CertificateTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CERT_WIDTH = 1122;
const CERT_HEIGHT = 793;

function buildSampleData(
  directorName: string,
  directorTitle: string,
  logoUrl: string | null,
): CertificateData {
  return {
    certificateNumber: "CERT-XXXX-XXXX",
    courseTitle: "Advanced React Development",
    firstName: "Student",
    lastName: "Name",
    formattedIssuedAt: "January 1, 2026",
    directorName,
    directorTitle,
    logoUrl: logoUrl ?? undefined,
    verifyUrl: "https://example.com/certificate/CERT-XXXX-XXXX",
    // Extra variables so custom-design previews render filled tokens.
    testSeriesTitle: "Full Stack Test Series",
    hoursText: "12 hours",
    lessonsCompleted: 24,
    quizzesPassed: 6,
    finalScore: "88%",
    expiryText: "January 1, 2028",
    tenantName: directorName,
  };
}

/** Reconstruct a full CertificateDesign from a stored template row. */
function rowToDesign(row: CertificateTemplateRow): CertificateDesign {
  const layout = row.layout ?? { page: {}, elements: [] };
  return {
    page: {
      size: (row.page_size as CertificateDesign["page"]["size"]) ?? "A4",
      orientation:
        (row.orientation as CertificateDesign["page"]["orientation"]) ??
        "LANDSCAPE",
    },
    background: {
      assetUrl: row.background_asset_url ?? layout.background?.assetUrl ?? null,
      color: layout.background?.color ?? "#ffffff",
    },
    elements: layout.elements ?? [],
  };
}

/** Scale a config design to fit a target width, mirroring ScaledCertificate. */
function ScaledConfigCertificate({
  design,
  data,
  targetWidth,
}: {
  design: CertificateDesign;
  data: CertificateData;
  targetWidth: number;
}) {
  const dims =
    CERTIFICATE_PAGE_DIMENSIONS[design.page.size][design.page.orientation];
  const scale = targetWidth / dims.width;
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

/**
 * Scales a full-size (1122x793) certificate to fit within the container's width.
 * Uses CSS transform so the template itself renders at native size, guaranteeing
 * pixel-perfect parity with the student-facing certificate view.
 */
function ScaledCertificate({
  templateId,
  data,
  scale,
}: {
  templateId: string;
  data: CertificateData;
  scale: number;
}) {
  return (
    <div
      className="relative"
      style={{
        width: CERT_WIDTH * scale,
        height: CERT_HEIGHT * scale,
      }}
    >
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

function TemplateThumbnail({
  template,
  data,
  isActive,
  isSelected,
}: {
  template: CertificateTemplateInfo;
  data: CertificateData;
  isActive: boolean;
  isSelected: boolean;
}) {
  // Card width ~ 180px, thumbnail must fit aspect 297/210
  const thumbWidth = 180;
  const scale = thumbWidth / CERT_WIDTH;

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-lg border-2 transition-all ${
        isSelected
          ? "border-primary ring-primary/20 ring-2"
          : isActive
            ? "border-primary/50"
            : "border-border hover:border-primary/40 cursor-pointer"
      }`}
    >
      {isSelected && (
        <div className="bg-primary absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      <div className="aspect-[297/210] overflow-hidden bg-white">
        <ScaledCertificate templateId={template.id} data={data} scale={scale} />
      </div>

      <div className="border-t px-2 py-1.5">
        <p className="truncate text-xs font-medium">{template.name}</p>
      </div>
    </div>
  );
}

export function CertificateTemplateModal({ open, onOpenChange }: CertificateTemplateModalProps) {
  useCertificateFonts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selectedTenantId, selectedTenant } = useTenantStore();

  const { data: selectedData } = useSelectedCertificateTemplate(open);

  useEffect(() => {
    if (open && selectedData?.logoUrl) {
      setLogoUrl(selectedData.logoUrl);
    }
  }, [open, selectedData?.logoUrl]);

  const { data: templatesData, isLoading: templatesLoading } = useCertificateTemplates();
  const selectTemplate = useSelectCertificateTemplate();
  const { data: customDesigns } = useCertificateDesigns();
  const setDefaultDesign = useSetDefaultCertificateDesign();
  const { data: orgDetails } = useOrgDetails();

  const designs = useMemo(() => customDesigns ?? [], [customDesigns]);
  const selectedDesign = useMemo(
    () => designs.find((d) => d.id === selectedCustomId) ?? null,
    [designs, selectedCustomId],
  );

  const templates = useMemo(() => templatesData?.templates ?? [], [templatesData?.templates]);
  const selectedTemplateName = useMemo(
    () => templates.find((t) => t.id === selectedId)?.name ?? "",
    [templates, selectedId],
  );

  const directorName = useMemo(() => {
    if (orgDetails?.founderName) return orgDetails.founderName;
    if (selectedTenant?.tenant_name) return selectedTenant.tenant_name;
    return "Director";
  }, [orgDetails?.founderName, selectedTenant?.tenant_name]);

  const directorTitle = useMemo(() => {
    const title = orgDetails?.founderTitle?.trim();
    return title && title.length > 0 ? title : "Director";
  }, [orgDetails?.founderTitle]);

  const sampleData = useMemo(
    () => buildSampleData(directorName, directorTitle, logoUrl),
    [directorName, directorTitle, logoUrl],
  );

  const activePreviewId = previewId ?? selectedId ?? templates[0]?.id ?? null;

  const handleThumbnailClick = (template: CertificateTemplateInfo) => {
    setPreviewId(template.id);
    setSelectedCustomId(null);
    if (template.available) {
      setSelectedId(template.id);
    }
  };

  const handleCustomClick = (id: string) => {
    setSelectedCustomId(id);
    setSelectedId(null);
    setPreviewId(null);
  };

  const handleUseCustom = () => {
    if (!selectedCustomId) return;
    setDefaultDesign.mutate(selectedCustomId, {
      onSuccess: () => {
        toast({
          title: "Custom certificate active",
          description:
            "Your design is now the certificate learners receive (it takes priority over presets).",
        });
        resetAndClose();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to set design.",
          variant: "destructive",
        });
      },
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file",
        description: "Please upload a PNG, JPG, WebP, or SVG image.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Logo must be under 5MB.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTenantId) {
      toast({ title: "Error", description: "No tenant selected.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const result = await uploadApi.uploadCategoryIcon(file, {
        type: "category_icon",
        tenantId: selectedTenantId,
      });
      setLogoUrl(result.url);
      toast({ title: "Logo uploaded", description: "Logo will appear on your certificate." });
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirm = () => {
    if (!selectedId) return;

    selectTemplate.mutate(
      { templateId: selectedId, logoUrl },
      {
        onSuccess: () => {
          // Selecting a preset deactivates any custom default (server-side), so
          // refresh the designs list to clear the "Active" badge.
          queryClient.invalidateQueries({
            queryKey: certificateDesignerKeys.list(),
          });
          toast({ title: "Success", description: "Certificate template selected." });
          resetAndClose();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to select template.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const resetAndClose = () => {
    setStep(1);
    setSelectedId(null);
    setSelectedCustomId(null);
    setPreviewId(null);
    onOpenChange(false);
  };

  // Compact preview that fits comfortably in the left column (side-by-side layout).
  const LARGE_WIDTH = 480;
  const largeScale = LARGE_WIDTH / CERT_WIDTH;

  const activeTemplateMeta = useMemo(
    () => templates.find((t) => t.id === activePreviewId) ?? null,
    [templates, activePreviewId],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetAndClose();
        else onOpenChange(val);
      }}
    >
      <DialogContent
        className={`flex max-h-[90vh] flex-col overflow-hidden p-0 ${
          step === 1 ? "max-w-5xl" : "max-w-4xl"
        }`}
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle>
                {step === 1 ? "Select Certificate Template" : "Upload Certificate Logo"}
              </DialogTitle>
              <DialogDescription>
                {step === 1
                  ? "Choose a certificate design, step 1 of 2"
                  : "Upload your organization logo, step 2 of 2"}
              </DialogDescription>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div
              className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`}
            />
            <div
              className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`}
            />
          </div>
        </DialogHeader>

        {templatesLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        ) : step === 1 ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Left: large preview (sticky / non-scrolling) */}
            <div className="flex flex-col gap-4 overflow-y-auto border-b px-6 py-6 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-5 dark:from-gray-900 dark:to-gray-800">
                {selectedDesign ? (
                  <ScaledConfigCertificate
                    design={rowToDesign(selectedDesign)}
                    data={sampleData}
                    targetWidth={LARGE_WIDTH}
                  />
                ) : activePreviewId ? (
                  <ScaledCertificate
                    templateId={activePreviewId}
                    data={sampleData}
                    scale={largeScale}
                  />
                ) : (
                  <p className="text-muted-foreground py-12 text-sm">
                    Select a template to preview
                  </p>
                )}
              </div>

              {selectedDesign ? (
                <div className="space-y-1">
                  <p className="text-base font-semibold">{selectedDesign.name}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Your custom design. Selecting it makes it the certificate
                    learners receive.
                  </p>
                </div>
              ) : (
                activeTemplateMeta && (
                  <div className="space-y-1">
                    <p className="text-base font-semibold">{activeTemplateMeta.name}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {activeTemplateMeta.description}
                    </p>
                  </div>
                )
              )}
            </div>

            {/* Right: scrollable thumbnail grid */}
            <div className="flex min-h-0 flex-col">
              <div className="flex items-center justify-between border-b px-6 py-3">
                <p className="text-sm font-medium">
                  {designs.length > 0
                    ? `${designs.length} custom + ${templates.length} presets`
                    : `${templates.length} templates available`}
                </p>
                <p className="text-muted-foreground text-xs">Click to preview</p>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {designs.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                      Your designs
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {designs.map((d) => {
                        const isSel = selectedCustomId === d.id;
                        return (
                          <div
                            key={d.id}
                            onClick={() => handleCustomClick(d.id)}
                            className={`relative flex cursor-pointer flex-col overflow-hidden rounded-lg border-2 transition-all ${
                              isSel
                                ? "border-primary ring-primary/20 ring-2"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            {isSel && (
                              <div className="bg-primary absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <div className="flex aspect-[297/210] items-center justify-center overflow-hidden bg-white">
                              <ScaledConfigCertificate
                                design={rowToDesign(d)}
                                data={sampleData}
                                targetWidth={180}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 border-t px-2 py-1.5">
                              <p className="truncate text-xs font-medium">
                                {d.name}
                              </p>
                              {d.is_default && (
                                <span className="shrink-0 text-[9px] font-medium text-green-700">
                                  Active
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  {designs.length > 0 && (
                    <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                      Presets
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => handleThumbnailClick(template)}
                      >
                        <TemplateThumbnail
                          template={template}
                          data={sampleData}
                          isActive={activePreviewId === template.id}
                          isSelected={selectedId === template.id}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="text-muted-foreground text-sm">
                  Selected template:{" "}
                  <span className="text-foreground font-medium">{selectedTemplateName}</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-5 rounded-xl border border-dashed p-8">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-2 bg-gray-50 dark:bg-gray-900">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <Upload className="h-8 w-8 text-gray-300" />
                  )}
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium">
                    {logoUrl ? "Logo uploaded" : "Upload your organization logo"}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {logoUrl
                      ? "This logo will appear at the top of the certificate"
                      : "PNG, JPG, WebP, or SVG, max 5MB"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {logoUrl && (
                    <Button variant="outline" size="sm" onClick={() => setLogoUrl(null)}>
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                  <Button
                    variant={logoUrl ? "outline" : "default"}
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {logoUrl ? "Change Logo" : "Upload Logo"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>

                {!logoUrl && (
                  <p className="text-muted-foreground text-xs italic">
                    You can skip this step, logo is optional
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          {step === 1 ? (
            selectedCustomId ? (
              <Button
                onClick={handleUseCustom}
                disabled={setDefaultDesign.isPending}
              >
                {setDefaultDesign.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Use this design
              </Button>
            ) : (
              <Button onClick={() => setStep(2)} disabled={!selectedId}>
                Next
              </Button>
            )
          ) : (
            <Button onClick={handleConfirm} disabled={selectTemplate.isPending}>
              {selectTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Select Certificate
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
