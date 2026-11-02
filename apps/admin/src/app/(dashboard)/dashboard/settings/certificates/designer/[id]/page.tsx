"use client";

import { useToast } from "@open-mtlms/core";
import type {
  CertificateDesign,
  CertificateOrientation,
  CertificatePageSize,
} from "@open-mtlms/certificate-templates";
import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { CertificateDesigner } from "@/components/certificate-designer/CertificateDesigner";
import {
  useCertificateDesign,
  useUpdateCertificateDesign,
} from "@/lib/hooks/use-certificate-designer";

export default function CertificateDesignerEditorPage() {
  const params = useParams();
  const id = params?.id ? String(params.id) : "";
  const { toast } = useToast();
  const { data: template, isLoading } = useCertificateDesign(id);
  const update = useUpdateCertificateDesign();

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  const design: CertificateDesign = {
    page: {
      size: (template.page_size as CertificatePageSize) ?? "A4",
      orientation: (template.orientation as CertificateOrientation) ?? "LANDSCAPE",
    },
    background: {
      assetUrl: template.background_asset_url,
      color: template.layout?.background?.color ?? "#ffffff",
    },
    elements: template.layout?.elements ?? [],
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/settings/certificates/designer"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="h-4 w-4" /> Certificate templates
      </Link>
      <CertificateDesigner
        initialName={template.name}
        initialDesign={design}
        saving={update.isPending}
        onSave={(name, next) =>
          update.mutate(
            {
              id,
              payload: {
                name,
                pageSize: next.page.size,
                orientation: next.page.orientation,
                backgroundAssetUrl: next.background?.assetUrl ?? null,
                layout: next,
              },
            },
            {
              onSuccess: () => toast({ title: "Template saved" }),
              onError: () =>
                toast({ title: "Could not save", variant: "destructive" }),
            },
          )
        }
      />
    </div>
  );
}
