"use client";

import { Award, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

import { useMemberCertificates } from "@/lib/hooks/use-member-analytics";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
    >
      {copied ? <><Check className="h-3 w-3 text-emerald-600" /> Copied</> : <><Copy className="h-3 w-3" /> Copy Link</>}
    </button>
  );
}

export default function CertificatesTab() {
  const { data: certificates, isLoading } = useMemberCertificates();

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>;
  }

  if (!certificates?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-16 dark:border-zinc-700">
        <Award className="mb-3 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No certificates yet</p>
        <p className="mt-1 text-xs text-zinc-400">Complete a course to earn your first certificate</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
          My Certificates ({certificates.length})
        </h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {certificates.map((cert) => {
          // Same-origin verify URL: the student views this on their tenant's
          // current-environment domain, so this is always a correct, working
          // link (dev domain in dev, prod domain in prod).
          const verifyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/certificate/${cert.certificateNumber}`;
          return (
            <div key={cert.id} className="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Award className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">{cert.title}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-400">#{cert.certificateNumber}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Issued {new Date(cert.issuedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Issued
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <Link
                  href={`/certificate/${cert.certificateNumber}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="h-3 w-3" /> View
                </Link>
                <CopyBtn text={verifyUrl} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
