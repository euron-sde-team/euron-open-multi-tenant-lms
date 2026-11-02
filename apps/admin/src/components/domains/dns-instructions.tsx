"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { Check, Copy, CopyCheck } from "lucide-react";
import { useState } from "react";

import type { DnsRecord } from "@/lib/types";

interface DnsInstructionsProps {
  records: DnsRecord[];
  domainName?: string;
}

function displayRecordHost(host: string): string {
  if (!host || host === "@") return "@";
  return host;
}

export function DnsInstructions({ records, domainName: _domainName }: DnsInstructionsProps) {
  const [copiedValue, setCopiedValue] = useState<number | null>(null);
  const [copiedName, setCopiedName] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyToClipboard = async (text: string, index: number, field: "name" | "value") => {
    try {
      await navigator.clipboard.writeText(text);
      if (field === "name") {
        setCopiedName(index);
        setTimeout(() => setCopiedName(null), 2000);
      } else {
        setCopiedValue(index);
        setTimeout(() => setCopiedValue(null), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const copyAllRecords = async () => {
    const text = records
      .map((r) => `${r.type}\t${displayRecordHost(r.host)}\t${r.value}\t${r.purpose}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (records.length === 0) {
    return null;
  }

  return (
    <Card className="w-full max-w-5xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">DNS Configuration Required</CardTitle>
            <CardDescription>
              Add the following DNS records in your Cloudflare DNS dashboard to verify ownership
              and route traffic to your site.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyAllRecords}
            className="flex-shrink-0"
          >
            {copiedAll ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <CopyCheck className="h-4 w-4 mr-2" />
            )}
            {copiedAll ? "Copied" : "Copy all"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border">
          <div className="grid grid-cols-5 gap-4 border-b bg-muted/50 px-4 py-3 text-sm font-medium">
            <div>Type</div>
            <div>Name/Host</div>
            <div className="col-span-2">Value/Points To</div>
            <div>Purpose</div>
          </div>
          {records.filter((r) => r.type !== "FORWARDING").map((record, index) => (
            <div key={index} className="border-b last:border-b-0">
              <div className="grid grid-cols-5 gap-4 px-4 py-3 text-sm">
                <div className="font-mono">{record.type}</div>
                <div className="font-mono break-all flex items-center gap-1">
                  <span>{displayRecordHost(record.host)}</span>
                  <button
                    onClick={() => copyToClipboard(displayRecordHost(record.host), index, "name")}
                    className="flex-shrink-0 p-1 hover:bg-muted rounded"
                    title="Copy name"
                  >
                    {copiedName === index ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <code className="break-all rounded bg-muted px-2 py-1 text-xs flex-1">
                    {record.value}
                  </code>
                  <button
                    onClick={() => copyToClipboard(record.value, index, "value")}
                    className="flex-shrink-0 p-1 hover:bg-muted rounded"
                    title="Copy value"
                  >
                    {copiedValue === index ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <div className="text-muted-foreground text-xs">{record.purpose}</div>
              </div>
              {record.isRootApex && record.type === "CNAME" && (
                <div className="mx-4 mb-3 rounded p-3 text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200">
                  <strong>CNAME Flattening:</strong> Cloudflare automatically handles CNAME records
                  on the root domain (@) via CNAME Flattening. Add this record as shown, no
                  separate forwarding setup needed. Ensure proxy status is set to &quot;DNS
                  only&quot; (gray cloud).
                </div>
              )}
            </div>
          ))}
        </div>

        {records.some((r) => r.type === "FORWARDING") && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Root Domain via CNAME Flattening
            </p>
            <p className="mt-1 text-blue-700 dark:text-blue-300">
              Add a CNAME record in Cloudflare with Name <strong>@</strong> and Target{" "}
              <strong>www.yourdomain.com</strong>. Cloudflare&apos;s CNAME Flattening handles the
              rest, no forwarding configuration needed. Keep proxy OFF (gray cloud).
            </p>
          </div>
        )}

        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">Important Notes:</p>
          <ul className="list-disc list-inside mt-2 text-amber-700 dark:text-amber-300 space-y-1">
            <li>DNS changes in Cloudflare typically propagate within 5–15 minutes.</li>
            <li>SSL certificate provisioning may take up to 30 minutes after DNS verification.</li>
            <li>
              Ensure proxy status is <strong>&quot;DNS only&quot;</strong> (gray cloud) for all
              records, do not enable the orange cloud proxy.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
