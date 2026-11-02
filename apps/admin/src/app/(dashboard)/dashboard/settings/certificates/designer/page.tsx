"use client";

import { Button, Card, CardContent, useToast } from "@open-mtlms/core";
import { Award, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  useCertificateDesigns,
  useCreateCertificateDesign,
  useDeleteCertificateDesign,
  useSetDefaultCertificateDesign,
} from "@/lib/hooks/use-certificate-designer";

export default function CertificateDesignerListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: templates, isLoading } = useCertificateDesigns();
  const create = useCreateCertificateDesign();
  const del = useDeleteCertificateDesign();
  const setDefault = useSetDefaultCertificateDesign();

  const handleCreate = () =>
    create.mutate(
      {
        name: "Untitled certificate",
        pageSize: "A4",
        orientation: "LANDSCAPE",
        layout: {
          page: { size: "A4", orientation: "LANDSCAPE" },
          background: { assetUrl: null, color: "#ffffff" },
          elements: [],
        },
      },
      {
        onSuccess: (t) =>
          router.push(`/dashboard/settings/certificates/designer/${t.id}`),
        onError: () =>
          toast({ title: "Could not create template", variant: "destructive" }),
      },
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Certificate templates
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Design custom certificates for your courses and test series.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          New template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Award className="text-muted-foreground/40 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              No certificate templates yet. Create your first design.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{t.name}</span>
                    {t.is_default && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <Star className="h-3 w-3" /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t.page_size} · {t.orientation.toLowerCase()} ·{" "}
                    {t.layout?.elements?.length ?? 0} elements
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {!t.is_default && (
                    <button
                      type="button"
                      onClick={() =>
                        setDefault.mutate(t.id, {
                          onSuccess: () => toast({ title: "Set as default" }),
                        })
                      }
                      className="text-muted-foreground hover:text-foreground text-sm"
                    >
                      Set default
                    </button>
                  )}
                  <Link
                    href={`/dashboard/settings/certificates/designer/${t.id}`}
                    className="hover:bg-muted inline-flex h-8 items-center gap-1 rounded-md border px-3 text-sm"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this template?"))
                        del.mutate(t.id);
                    }}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
