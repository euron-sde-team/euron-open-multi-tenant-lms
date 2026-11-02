"use client";

import { SidebarNavManager } from "@/components/settings/navigation";

export default function NavigationSettingsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Navigation</h1>
        <p className="text-muted-foreground">
          Manage your site&apos;s sidebar navigation. Reorder items, change icons and labels,
          toggle visibility, or add custom links.
        </p>
      </div>

      <SidebarNavManager />

      <div className="mt-8 rounded-lg border bg-muted/30 p-6">
        <h2 className="mb-2 text-lg font-semibold">About Navigation Items</h2>
        <div className="text-muted-foreground space-y-4 text-sm">
          <p>
            <strong>System items</strong> (e.g. Home) are always present and cannot be
            deleted or have their links changed. You can hide, rename, reorder, and change
            their icon.
          </p>
          <p>
            <strong>Feature items</strong> are driven by your platform&apos;s feature catalog.
            Their links are locked but you can hide, rename, reorder, and change icons.
            Items marked <em>&quot;Not in plan&quot;</em> are features not included in your
            current subscription, they won&apos;t appear in your users&apos; sidebar even
            if visible here.
          </p>
          <p>
            <strong>Custom links</strong> are fully editable and can point to internal
            pages or external URLs. You can add, edit, reorder, and delete them freely.
          </p>
        </div>
      </div>
    </div>
  );
}
