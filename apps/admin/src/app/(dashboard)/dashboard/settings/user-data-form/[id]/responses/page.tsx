"use client";

import { Button, Card, CardContent } from "@open-mtlms/core";
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  memberFormApi,
  type MemberFormField,
  type MemberFormResponse,
} from "@/lib/api/member-form";
import { useMemberFormResponses } from "@/lib/hooks/use-member-form";
import { useTenantStore } from "@/lib/stores/tenant-store";

const BASE = "/dashboard/settings/user-data-form";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toCsv(fields: MemberFormField[], rows: MemberFormResponse[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Name", "Email", "Phone", ...fields.map((f) => f.label), "Submitted"];
  const lines = rows.map((r) =>
    [
      r.memberName,
      r.memberEmail ?? "",
      r.memberPhone ?? "",
      ...fields.map((f) => formatValue(r.data[f.name])),
      formatDate(r.completedAt),
    ]
      .map((c) => escape(String(c)))
      .join(",")
  );
  return [header.map(escape).join(","), ...lines].join("\n");
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "form"
  );
}

export default function MemberFormResponsesPage() {
  const params = useParams();
  const formId = (params?.id as string) ?? "";
  const { selectedTenantId } = useTenantStore();
  const tenantId = selectedTenantId ?? undefined;
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const limit = 25;

  const { data, isLoading } = useMemberFormResponses(tenantId, formId, page);

  const fields = data?.fields ?? [];
  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const handleExport = async () => {
    if (!data || data.total === 0) return;
    setExporting(true);
    try {
      // Page through the API (200/page) so the CSV covers ALL responses.
      const pageSize = 200;
      const all: MemberFormResponse[] = [];
      let exportFields: MemberFormField[] = fields;
      let p = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await memberFormApi.listResponses(formId, {
          page: p,
          limit: pageSize,
        });
        exportFields = res.fields;
        all.push(...res.responses);
        if (all.length >= res.total || res.responses.length === 0) break;
        p += 1;
      }

      const csv = toCsv(exportFields, all);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(data.form.name)}-responses.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`${BASE}/${formId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {data?.form.name ?? "Form"} responses
            </h1>
            <p className="text-sm text-muted-foreground">
              Data your users submitted through this form.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={!data || data.total === 0 || exporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading...</div>
      ) : !data || data.responses.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No responses yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="whitespace-nowrap px-4 py-3 font-medium">
                      Member
                    </th>
                    {fields.map((f) => (
                      <th
                        key={f.id}
                        className="whitespace-nowrap px-4 py-3 font-medium"
                      >
                        {f.label}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-4 py-3 font-medium">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.responses.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b align-top transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/users/${r.memberId}`}
                          className="hover:underline"
                        >
                          <p className="font-medium">{r.memberName}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.memberEmail || r.memberPhone || "-"}
                          </p>
                        </Link>
                      </td>
                      {fields.map((f) => (
                        <td
                          key={f.id}
                          className="px-4 py-3 text-muted-foreground"
                        >
                          {formatValue(r.data[f.name]) || "-"}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(r.completedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of{" "}
            {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
