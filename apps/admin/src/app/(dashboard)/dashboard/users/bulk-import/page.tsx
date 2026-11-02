"use client";

import { Button } from "@open-mtlms/core";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { BulkImportPage } from "../../../../../components/bulk-import/BulkImportPage";

export default function TenantBulkImportPage() {
  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to users
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Bulk import users</h1>
        </div>
        <BulkImportPage
          scope="TENANT"
          contextTitle="All tenant members"
          contextSubtitle="Onboard new users without granting any course or book access. Email or phone is required per row."
        />
      </div>
    </>
  );
}
