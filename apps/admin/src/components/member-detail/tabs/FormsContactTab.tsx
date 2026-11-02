"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";

import { useMemberResponses } from "@/lib/hooks/use-member-form";
import { useTenantStore } from "@/lib/stores/tenant-store";

interface Props {
  memberId: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const str = String(value).trim();
  return str.length ? str : "-";
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

export function FormsContactTab({ memberId }: Props) {
  const { selectedTenantId } = useTenantStore();
  const tenantId = selectedTenantId ?? undefined;

  const { data: formResponses, isLoading: formLoading } = useMemberResponses(
    tenantId,
    memberId
  );

  return (
    <div className="space-y-6">
      {/* Profile form responses (one block per form the member completed) */}
      <Card>
        <CardHeader>
          <CardTitle>User data form responses</CardTitle>
          <CardDescription>
            Answers this member submitted to your custom user data forms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !formResponses || formResponses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This member has not completed any forms yet.
            </p>
          ) : (
            <div className="space-y-5">
              {formResponses.map((form) => (
                <div
                  key={form.formId}
                  className="rounded-lg border p-4 first:pt-4"
                >
                  <p className="mb-3 text-sm font-semibold">{form.formName}</p>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {form.fields.map((f) => (
                      <div key={f.id}>
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {f.label}
                        </dt>
                        <dd className="mt-0.5 text-sm text-foreground">
                          {formatValue(form.data[f.name])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="pt-3 text-xs text-muted-foreground">
                    Submitted {formatDate(form.completedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
