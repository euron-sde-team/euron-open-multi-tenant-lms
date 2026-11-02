"use client";

import { bookTemplateConfigs, type BookTemplateId } from "@open-mtlms/book-templates";
import { Button, Card, CardContent } from "@open-mtlms/core";
import { ArrowLeft, Check, Eye } from "lucide-react";
import Link from "next/link";

import { useTenantSettingsStore } from "@/lib/stores/tenant-settings-store";
import { useTenantStore } from "@/lib/stores/tenant-store";

// Default template when none is selected
const DEFAULT_BOOK_TEMPLATE_ID: BookTemplateId = "amazon";

export default function BookTemplatesPage() {
  const { selectedTenantId } = useTenantStore();
  const { getBookPageTemplateId } = useTenantSettingsStore();
  
  const currentTemplateId = selectedTenantId 
    ? getBookPageTemplateId(selectedTenantId) || DEFAULT_BOOK_TEMPLATE_ID 
    : DEFAULT_BOOK_TEMPLATE_ID;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/books">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Book Page Templates</h1>
          <p className="text-muted-foreground">
            Choose a template for your book detail pages.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {bookTemplateConfigs.map((template) => {
          const isSelected = template.id === currentTemplateId;
          return (
            <Card key={template.id} className={isSelected ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {template.name}
                        {isSelected && (
                          <span className="text-xs text-primary font-normal flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </h3>
                      <p className="text-muted-foreground text-sm mt-1">{template.description}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild className="w-fit">
                    <Link href={`/dashboard/books/templates/${template.id}/preview`}>
                      <Eye className="mr-2 h-3 w-3" />
                      Preview & Select
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-muted-foreground text-sm">
            Select a template to customize how your book detail pages appear to users. The Amazon Style template is recommended for an e-commerce experience.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
