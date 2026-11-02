"use client";

import {
  BookProvider,
  ClassicTemplate,
  ModernTemplate,
  MinimalTemplate,
  AmazonTemplate,
  bookTemplateConfigs,
  sampleBookData,
  sampleAuthors,
  sampleCategories,
  type BookTemplateId,
} from "@open-mtlms/book-templates";
import { Button, useToast } from "@open-mtlms/core";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { THUMBNAILS_BASE_URL } from "@/lib/constants";
import { useTenantSettingsStore } from "@/lib/stores/tenant-settings-store";
import { useTenantStore } from "@/lib/stores/tenant-store";

// Template component mapping
const templateComponents: Record<BookTemplateId, React.ComponentType<{ onStartReading?: () => void; onUnlock?: () => void }>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  amazon: AmazonTemplate,
};

export default function BookTemplatePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { selectedTenantId } = useTenantStore();
  const { setBookPageTemplate, getBookPageTemplateId } = useTenantSettingsStore();
  
  const [isSaving, setIsSaving] = useState(false);
  
  const templateId = (params?.id as BookTemplateId) ?? "minimal";
  const template = bookTemplateConfigs.find((t) => t.id === templateId);
  const TemplateComponent = templateComponents[templateId];
  
  // Check if this template is already selected
  const currentTemplateId = selectedTenantId ? getBookPageTemplateId(selectedTenantId) : null;
  const isCurrentTemplate = currentTemplateId === templateId;
  
  if (!template || !TemplateComponent) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Template not found</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/books/templates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Templates
          </Link>
        </Button>
      </div>
    );
  }

  const handleSelectTemplate = async () => {
    if (!selectedTenantId) {
      toast({
        title: "Error",
        description: "Please select a tenant first.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      // Save template selection to tenant settings store
      setBookPageTemplate(selectedTenantId, templateId);
      
      toast({
        title: "Template Saved",
        description: `"${template.name}" is now your book page template.`,
      });
      
      router.push("/dashboard/books/templates");
    } catch (error) {
      console.error("Failed to save template:", error);
      toast({
        title: "Error",
        description: "Failed to save template selection.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/books/templates">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold">{template.name} Template</h1>
              <p className="text-xs text-muted-foreground">Preview Mode</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isCurrentTemplate && (
              <span className="mr-2 text-sm text-green-600 dark:text-green-400">
                Currently Selected
              </span>
            )}
            <Button
              onClick={handleSelectTemplate}
              disabled={isSaving || isCurrentTemplate}
              variant={isCurrentTemplate ? "outline" : "default"}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isCurrentTemplate ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Selected
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Select This Template
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Template Preview */}
      <BookProvider
        bookData={sampleBookData}
        authors={sampleAuthors}
        categories={sampleCategories}
        isEditMode={false}
        thumbnailBaseUrl={THUMBNAILS_BASE_URL}
      >
        <TemplateComponent
          onStartReading={() => {
            toast({
              title: "Preview Mode",
              description: "Start reading is disabled in preview mode.",
            });
          }}
          onUnlock={() => {
            toast({
              title: "Preview Mode",
              description: "Unlock is disabled in preview mode.",
            });
          }}
        />
      </BookProvider>
    </div>
  );
}
