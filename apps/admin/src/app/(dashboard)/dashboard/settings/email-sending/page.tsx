"use client";

/**
 * Settings → Email Sending: Phase 14.
 *
 * Single page that progresses through four states:
 *
 *   1. Empty:    No sending domain onboarded yet. Show explainer + CTA.
 *   2. Form:     Tenant clicked CTA, fills in subdomain.
 *   3. PENDING:  Domain created, awaiting DNS verification. Show DNS records
 *                table with copy buttons + "Check verification" + "Delete"
 *                + the user's exact next steps.
 *   4. VERIFIED: Show status banner + identities CRUD + reputation summary.
 *
 *   FAILED state: shows the same UI as PENDING with an extra warning banner.
 *
 * IMPORTANT, onboarding is OPT-IN. This is the ONLY entry point for the
 * onboardSendingDomain API call; never invoked from any other flow.
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  useToast,
} from "@open-mtlms/core";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  History,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  ShieldOff,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import type {
  DnsRecord,
  SendingDomain,
  SenderIdentity,
} from "@/lib/api/email-engine";
import {
  useArchiveSenderIdentity,
  useCheckSendingDomain,
  useCreateSenderIdentity,
  useDeleteSendingDomain,
  useOnboardSendingDomain,
  useReputationOverview,
  useSendingDomains,
  useSenderIdentities,
  useUpdateSenderIdentity,
} from "@/lib/hooks/use-email-engine";
import { useHasPermission } from "@/lib/hooks/use-permissions";
import { EXAMPLE_SENDER_EMAIL } from "@/lib/brand";

export default function EmailSendingSettingsPage() {
  const canManage = useHasPermission("email_sending.manage");
  const { data: domains, isLoading: domainsLoading } = useSendingDomains();
  const domain = domains?.[0] ?? null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Email Sending</h1>
        <p className="text-muted-foreground mt-1">
          Send platform emails (welcome, OTP, transactional) from
          your own brand domain instead of the platform default sender ({EXAMPLE_SENDER_EMAIL}).
        </p>
      </header>

      {domainsLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : !domain ? (
        <EmptyStateCard canManage={canManage} />
      ) : (
        <ConfiguredDomainCard domain={domain} canManage={canManage} />
      )}

      {domain?.status === "VERIFIED" && (
        <>
          <SenderIdentitiesCard domainId={domain.id} canManage={canManage} />
          <ReputationSummaryCard />
          <ActivityLinksCard />
        </>
      )}
    </div>
  );
}

// ─── Activity links (suppressions + messages sub-pages) ────────

function ActivityLinksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity</CardTitle>
        <CardDescription className="mt-1.5">
          Inspect detailed send history and the per-recipient block list.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/dashboard/settings/email-sending/suppressions"
          className="group flex items-center justify-between rounded-md border p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-start gap-3">
            <ShieldOff className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium text-sm">Suppression list</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Recipients blocked from receiving certain categories. Review
                hard bounces, complaints, and manual unsubscribes; remove a
                row to allow sends again.
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          href="/dashboard/settings/email-sending/messages"
          className="group flex items-center justify-between rounded-md border p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium text-sm">Message log</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Every email sent through your domain, filterable by status
                (delivered, bounced, complained) and category (transactional,
                notification, marketing).
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Empty state ───────────────────────────────────────────────

function EmptyStateCard({ canManage }: { canManage: boolean }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Use your own sending domain</CardTitle>
        <CardDescription>
          By default, all your platform emails go out from
          the platform default sender ({EXAMPLE_SENDER_EMAIL}) with your organization name. Onboarding a
          custom domain (e.g. mail.your-school.com or your-school.com)
          makes emails deliver from your own brand instead. Transactional
          emails (OTPs, password resets, receipts) keep working the same
          way either path.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <div className="flex items-center justify-between rounded-md bg-muted/30 p-4">
            <div className="text-sm text-muted-foreground">
              You haven&apos;t set up a custom sending domain yet. Setup takes
              about 10 minutes; you&apos;ll need access to publish DNS records
              for your domain.
            </div>
            <Button
              onClick={() => setShowForm(true)}
              disabled={!canManage}
              title={canManage ? undefined : "Requires email_sending.manage permission"}
            >
              <Plus className="h-4 w-4 mr-2" />
              Get started
            </Button>
          </div>
        ) : (
          <OnboardForm onCancel={() => setShowForm(false)} />
        )}
      </CardContent>
    </Card>
  );
}

function OnboardForm({ onCancel }: { onCancel: () => void }) {
  const [sendingDomain, setSendingDomain] = useState("");
  const { toast } = useToast();
  const onboard = useOnboardSendingDomain();

  const normalized = sendingDomain.trim().toLowerCase();
  // 2 labels = apex (e.g. `example.com`); 3+ labels = subdomain.
  // Heuristic only; matches the backend's `isApexDomain()`.
  const looksLikeApex =
    normalized.length > 0 && normalized.split(".").length === 2;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!normalized) return;
      onboard.mutate(
        { subdomain: normalized },
        {
          onSuccess: () => {
            toast({
              title: "Domain registered",
              description:
                "Publish the DNS records shown next. Verification typically takes 5 to 60 minutes after DNS propagates.",
            });
          },
          onError: (err: Error) => {
            toast({
              title: "Onboarding failed",
              description: err.message,
              variant: "destructive",
            });
          },
        },
      );
    },
    [normalized, onboard, toast],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="sending-domain">Sending domain</Label>
        <Input
          id="sending-domain"
          placeholder="mail.your-school.com (recommended) or your-school.com"
          value={sendingDomain}
          onChange={(e) => setSendingDomain(e.target.value)}
          disabled={onboard.isPending}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          You can use either a subdomain (recommended, e.g.
          mail.your-school.com) or your root domain (e.g. your-school.com).
          Subdomain is the safer default because it isolates this platform&apos;s
          email reputation from your team&apos;s corporate mail, sales
          outreach, and any other system sending on your root domain.
        </p>
      </div>

      {looksLikeApex && (
        <div className="rounded-md border border-amber-300/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="space-y-1.5">
              <div className="font-medium text-amber-900 dark:text-amber-200">
                You&apos;re about to send from your root domain
              </div>
              <div className="text-muted-foreground">
                Sending bulk and transactional mail from{" "}
                <span className="font-mono">{normalized}</span> couples this
                platform&apos;s sender reputation to your corporate domain. A
                single bad campaign or a single tenant abusing the list can
                land <span className="font-mono">{normalized}</span> on a
                blocklist, which would also hurt your team&apos;s personal
                mail, sales outreach, and customer support replies.
              </div>
              <div className="text-muted-foreground">
                If you already have DMARC published on{" "}
                <span className="font-mono">{normalized}</span> with a strict
                policy (p=reject or p=quarantine), keep that record in place.
                After onboarding, we&apos;ll show you whatever DMARC we
                detect so you don&apos;t accidentally replace it.
              </div>
              <div className="text-muted-foreground">
                Prefer the subdomain path? Use something like{" "}
                <span className="font-mono">mail.{normalized}</span>{" "}
                instead.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={onboard.isPending || !normalized}>
          {onboard.isPending && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          {looksLikeApex
            ? "Register root domain anyway"
            : "Register domain"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Configured domain (PENDING / VERIFIED / FAILED) ───────────

function ConfiguredDomainCard({
  domain,
  canManage,
}: {
  domain: SendingDomain;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const check = useCheckSendingDomain();
  const remove = useDeleteSendingDomain();

  const handleCheck = useCallback(() => {
    check.mutate(domain.id, {
      onSuccess: (updated) => {
        if (updated.status === "VERIFIED") {
          toast({
            title: "Verified",
            description: "Your domain is now ready to send emails from.",
          });
        } else if (updated.status === "FAILED") {
          toast({
            title: "Verification failed",
            description:
              updated.failureReason ??
              "DNS records still missing or incorrect.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Still pending",
            description:
              "DNS hasn't propagated yet. Try again in a few minutes; the background poller also re-checks every 60 seconds.",
          });
        }
      },
      onError: (err: Error) => {
        toast({
          title: "Check failed",
          description: err.message,
          variant: "destructive",
        });
      },
    });
  }, [check, domain.id, toast]);

  const handleDelete = useCallback(() => {
    if (
      !confirm(
        `Remove the sending domain "${domain.subdomain}"? Your emails will go back to sending from ${EXAMPLE_SENDER_EMAIL}. You can re-onboard the same domain later if you change your mind.`,
      )
    )
      return;
    remove.mutate(domain.id, {
      onSuccess: () =>
        toast({
          title: "Domain removed",
          description: `Future emails for ${domain.subdomain} will use the platform default sender.`,
        }),
      onError: (err: Error) =>
        toast({
          title: "Delete failed",
          description: err.message,
          variant: "destructive",
        }),
    });
  }, [domain, remove, toast]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            {domain.subdomain}
          </CardTitle>
          <CardDescription className="mt-1.5">
            MAIL FROM: {domain.mailFromSubdomain} · Config set:{" "}
            {domain.sesConfigurationSet}
          </CardDescription>
        </div>
        <DomainStatusBadge status={domain.status} />
      </CardHeader>
      <CardContent className="space-y-5">
        {domain.status === "FAILED" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <div className="font-medium text-destructive">
                  Verification failed
                </div>
                <div className="text-muted-foreground mt-1">
                  {domain.failureReason ??
                    "DNS records have been missing or incorrect for over 24 hours."}{" "}
                  Re-check your DNS, then click Check verification.
                </div>
              </div>
            </div>
          </div>
        )}

        {domain.status === "PENDING" && (
          <div className="rounded-md border border-amber-300/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-sm">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-muted-foreground">
                Publish the DNS records below at your DNS provider, then click
                <strong className="text-foreground"> Check verification</strong>.
                A background sweep also re-checks every 60 seconds.
              </div>
            </div>
          </div>
        )}

        {domain.isApex && (
          <div className="rounded-md border border-amber-300/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="space-y-1.5">
                <div className="font-medium text-amber-900 dark:text-amber-200">
                  Sending from your root domain
                </div>
                <div className="text-muted-foreground">
                  Reputation for mail sent from{" "}
                  <span className="font-mono">{domain.subdomain}</span> is
                  shared with every other system sending on this domain.
                  Watch the Sending health card below; if bounce or complaint
                  rates rise, marketing sends pause automatically to protect
                  the rest of your mail.
                </div>
              </div>
            </div>
          </div>
        )}

        {domain.existingDmarcTxt && (
          <div className="rounded-md border border-blue-300/40 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="space-y-1.5 min-w-0">
                <div className="font-medium text-blue-900 dark:text-blue-200">
                  Existing DMARC record detected on{" "}
                  <span className="font-mono">_dmarc.{domain.subdomain}</span>
                </div>
                <div className="text-muted-foreground">
                  Current value (already published):
                </div>
                <pre className="rounded bg-muted px-2 py-1.5 text-xs font-mono overflow-x-auto">
                  {domain.existingDmarcTxt}
                </pre>
                <div className="text-muted-foreground">
                  Keep your existing record unless you have a specific reason
                  to change it. Our recommended <span className="font-mono">p=none</span>{" "}
                  record in the table below is for tenants who don&apos;t yet
                  have DMARC published. Overwriting a strict policy
                  (<span className="font-mono">p=quarantine</span> or
                  <span className="font-mono"> p=reject</span>) weakens your
                  domain&apos;s anti-spoofing posture.
                </div>
              </div>
            </div>
          </div>
        )}

        <DnsRecordsTable records={domain.dnsRecords} />

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            onClick={handleCheck}
            disabled={!canManage || check.isPending}
            variant="default"
          >
            {check.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Check verification
          </Button>
          <Button
            onClick={handleDelete}
            disabled={!canManage || remove.isPending}
            variant="ghost"
            className="text-destructive hover:bg-muted"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove domain
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Last checked:{" "}
            {domain.lastCheckedAt
              ? new Date(domain.lastCheckedAt).toLocaleString()
              : "never"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DomainStatusBadge({ status }: { status: SendingDomain["status"] }) {
  if (status === "VERIFIED") {
    return (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Verified
      </Badge>
    );
  }
  if (status === "FAILED") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (status === "DISABLED") {
    return <Badge variant="secondary">Disabled</Badge>;
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" /> Pending verification
    </Badge>
  );
}

function DnsRecordsTable({ records }: { records: DnsRecord[] }) {
  const { toast } = useToast();
  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(
        () => toast({ title: "Copied" }),
        () => toast({ title: "Copy failed", variant: "destructive" }),
      );
    },
    [toast],
  );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Purpose
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Type
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Name (host)
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Value
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Priority
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className="border-b last:border-b-0">
              <td className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                {r.purpose.replace(/_/g, " ")}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.type}</td>
              <td className="px-3 py-2 font-mono text-xs">
                <CopyableValue value={r.name} onCopy={() => copy(r.name)} />
              </td>
              <td className="px-3 py-2 font-mono text-xs break-all">
                <CopyableValue value={r.value} onCopy={() => copy(r.value)} />
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {r.priority ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyableValue({
  value,
  onCopy,
}: {
  value: string;
  onCopy: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{value}</span>
      <button
        type="button"
        onClick={onCopy}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="Copy"
      >
        <Copy className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─── Sender identities (only shown when VERIFIED) ──────────────

function SenderIdentitiesCard({
  domainId,
  canManage,
}: {
  domainId: string;
  canManage: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const { data: identities, isLoading } = useSenderIdentities();
  const active = (identities ?? []).filter((i) => i.status === "ACTIVE");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Sender identities</CardTitle>
          <CardDescription className="mt-1.5">
            FROM addresses on your verified domain. Set a default per
            category; the engine uses the matching default at send time.
            Categories: TRANSACTIONAL (OTPs, receipts), NOTIFICATION (updates,
            mentions), MARKETING (campaigns).
          </CardDescription>
        </div>
        {canManage && !showForm && (
          <Button onClick={() => setShowForm(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add identity
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <CreateIdentityForm
            domainId={domainId}
            onClose={() => setShowForm(false)}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : active.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No identities yet. Until you create one and mark it as default for
            a category, sends in that category will use the platform default
            ({EXAMPLE_SENDER_EMAIL}) with your tenant name.
          </p>
        ) : (
          <IdentitiesList identities={active} canManage={canManage} />
        )}
      </CardContent>
    </Card>
  );
}

function CreateIdentityForm({
  domainId: _domainId,
  onClose,
}: {
  domainId: string;
  onClose: () => void;
}) {
  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [defTrans, setDefTrans] = useState(false);
  const [defNotif, setDefNotif] = useState(false);
  const [defMarketing, setDefMarketing] = useState(false);
  const { toast } = useToast();
  const create = useCreateSenderIdentity();

  // Heuristic: the local-part probably maps to a real human mailbox if it
  // doesn't match common automated-sender patterns. Used to warn the
  // operator that they should set an explicit Reply-To so customer
  // replies don't pile up in a shared inbox no one watches.
  const localPart = emailAddress.includes("@")
    ? emailAddress.split("@")[0]?.trim().toLowerCase() ?? ""
    : "";
  const looksAutomated =
    /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|noreply|automated|mailer|notifications?|alerts?)$/.test(
      localPart,
    );
  const looksLikeRealMailbox = localPart.length > 0 && !looksAutomated;
  const replyToMissing = replyTo.trim().length === 0;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!emailAddress.trim()) return;
      create.mutate(
        {
          emailAddress: emailAddress.trim(),
          displayName: displayName.trim() || null,
          replyTo: replyTo.trim() || null,
          isDefaultTransactional: defTrans,
          isDefaultNotification: defNotif,
          isDefaultMarketing: defMarketing,
        },
        {
          onSuccess: () => {
            toast({ title: "Identity created" });
            onClose();
          },
          onError: (err: Error) =>
            toast({
              title: "Create failed",
              description: err.message,
              variant: "destructive",
            }),
        },
      );
    },
    [
      emailAddress,
      displayName,
      replyTo,
      defTrans,
      defNotif,
      defMarketing,
      create,
      toast,
      onClose,
    ],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-md border bg-muted/20 p-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="email-address">From address</Label>
          <Input
            id="email-address"
            placeholder="noreply@example.com or contact@example.com"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            The visible &quot;From&quot; address on every email. The local
            part can be a one-way alias (<span className="font-mono">noreply@</span>,{" "}
            <span className="font-mono">no-reply@</span>) OR an existing
            real-mailbox address (<span className="font-mono">contact@</span>,{" "}
            <span className="font-mono">hello@</span>). The domain part
            must match your verified sending domain.
          </p>
        </div>
        <div>
          <Label htmlFor="display-name">Display name (optional)</Label>
          <Input
            id="display-name"
            placeholder="Your School"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Shown to the recipient as the &quot;From&quot; name. If left
            blank, falls back to your organization name.
          </p>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="reply-to">
            Reply-To {looksLikeRealMailbox ? "(recommended)" : "(optional)"}
          </Label>
          <Input
            id="reply-to"
            placeholder="support@example.com"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
          />
          {looksLikeRealMailbox && replyToMissing ? (
            <div className="mt-2 rounded-md border border-amber-300/40 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-muted-foreground space-y-1">
                  <div className="font-medium text-amber-900 dark:text-amber-200">
                    You&apos;re using a real-mailbox address as the From.
                  </div>
                  <div>
                    Any recipient who hits Reply will write to{" "}
                    <span className="font-mono">{emailAddress.trim()}</span>{" "}
                    directly. Bounces and complaints still route to our
                    handlers; only human replies land there. Set an explicit
                    Reply-To (e.g.{" "}
                    <span className="font-mono">support@example.com</span>)
                    if you want replies to go to a triage queue instead of
                    this mailbox.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Where recipient replies are delivered. Leave blank to route
              replies back to the From address.
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Set as default for</Label>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={defTrans}
              onChange={(e) => setDefTrans(e.target.checked)}
            />
            Transactional
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={defNotif}
              onChange={(e) => setDefNotif(e.target.checked)}
            />
            Notification
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={defMarketing}
              onChange={(e) => setDefMarketing(e.target.checked)}
            />
            Marketing
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending || !emailAddress.trim()}>
          {create.isPending && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          Create identity
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function IdentitiesList({
  identities,
  canManage,
}: {
  identities: SenderIdentity[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const update = useUpdateSenderIdentity();
  const archive = useArchiveSenderIdentity();

  const toggleDefault = useCallback(
    (id: SenderIdentity, key: "transactional" | "notification" | "marketing") => {
      const payload: Parameters<typeof update.mutate>[0] = { id: id.id, input: {} };
      if (key === "transactional") payload.input.isDefaultTransactional = !id.isDefaultTransactional;
      if (key === "notification") payload.input.isDefaultNotification = !id.isDefaultNotification;
      if (key === "marketing") payload.input.isDefaultMarketing = !id.isDefaultMarketing;
      update.mutate(payload, {
        onError: (err: Error) =>
          toast({
            title: "Update failed",
            description: err.message,
            variant: "destructive",
          }),
      });
    },
    [update, toast],
  );

  const handleArchive = useCallback(
    (id: SenderIdentity) => {
      if (id.isDefaultTransactional || id.isDefaultNotification || id.isDefaultMarketing) {
        toast({
          title: "Cannot archive",
          description:
            "This identity is the default for at least one category. Promote a replacement first, then archive this one.",
          variant: "destructive",
        });
        return;
      }
      if (!confirm(`Archive sender identity ${id.emailAddress}?`)) return;
      archive.mutate(id.id, {
        onSuccess: () => toast({ title: "Identity archived" }),
        onError: (err: Error) =>
          toast({
            title: "Archive failed",
            description: err.message,
            variant: "destructive",
          }),
      });
    },
    [archive, toast],
  );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              From
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Display name
            </th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground">
              Transactional
            </th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground">
              Notification
            </th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground">
              Marketing
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody>
          {identities.map((id) => (
            <tr key={id.id} className="border-b last:border-b-0">
              <td className="px-3 py-2 font-mono text-xs">{id.emailAddress}</td>
              <td className="px-3 py-2 text-xs">{id.displayName ?? "-"}</td>
              <td className="px-3 py-2 text-center">
                <DefaultToggle
                  checked={id.isDefaultTransactional}
                  disabled={!canManage}
                  onChange={() => toggleDefault(id, "transactional")}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <DefaultToggle
                  checked={id.isDefaultNotification}
                  disabled={!canManage}
                  onChange={() => toggleDefault(id, "notification")}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <DefaultToggle
                  checked={id.isDefaultMarketing}
                  disabled={!canManage}
                  onChange={() => toggleDefault(id, "marketing")}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canManage}
                  onClick={() => handleArchive(id)}
                  className="text-destructive hover:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DefaultToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="cursor-pointer"
    />
  );
}

// ─── Reputation summary ────────────────────────────────────────

function ReputationSummaryCard() {
  const { data, isLoading } = useReputationOverview();

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Sending health</CardTitle>
          <CardDescription className="mt-1.5">
            Rolling 14-day bounce + complaint rates. Transactional emails
            always flow regardless of status; only marketing is gated.
          </CardDescription>
        </div>
        <SendingStatusBadge status={data.status} />
      </CardHeader>
      <CardContent>
        {data.marketingBlockedReason && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm mb-4">
            <div className="font-medium text-destructive">
              Marketing sends are paused
            </div>
            <div className="text-muted-foreground mt-1">
              {data.marketingBlockedReason}. Contact support to request a
              manual review. Transactional emails (OTPs, receipts) continue to
              send normally.
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Sent (14d)" value={data.rates.sent.toLocaleString()} />
          <Stat
            label="Delivered"
            value={`${(data.rates.deliveryRate * 100).toFixed(1)}%`}
          />
          <Stat
            label="Perm. bounce"
            value={`${(data.rates.permBounceRate * 100).toFixed(2)}%`}
            warn={data.rates.permBounceRate >= 0.03}
          />
          <Stat
            label="Complaints"
            value={`${(data.rates.complaintRate * 100).toFixed(3)}%`}
            warn={data.rates.complaintRate >= 0.0005}
          />
        </div>

        {data.recentEvents.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Recent status changes</span>
            </div>
            <div className="space-y-2">
              {data.recentEvents.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="text-[10px]">
                      {event.trigger.replace(/_/g, " ")}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {event.fromStatus} → {event.toStatus}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {event.reason}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`text-xl font-semibold mt-1 ${
          warn ? "text-amber-600" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SendingStatusBadge({
  status,
}: {
  status: "ACTIVE" | "WARNING" | "THROTTLED" | "PAUSED";
}) {
  if (status === "ACTIVE") {
    return (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
        Healthy
      </Badge>
    );
  }
  if (status === "WARNING") {
    return (
      <Badge variant="default" className="bg-amber-500 hover:bg-amber-500">
        Warning
      </Badge>
    );
  }
  if (status === "THROTTLED") {
    return (
      <Badge variant="default" className="bg-orange-600 hover:bg-orange-600">
        Throttled
      </Badge>
    );
  }
  return <Badge variant="destructive">Paused</Badge>;
}
