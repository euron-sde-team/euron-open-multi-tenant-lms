"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  useToast,
} from "@open-mtlms/core";
import { AlertTriangle, ArrowLeft, Briefcase, Check, Copy, CreditCard, Eye, EyeOff, Globe, Loader2, Plus, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { getErrorMessage } from "@open-mtlms/shared";

import { PermissionGate } from "@/components/permission-gate";
import { TenantSelector } from "@/components/tenant-selector";
import type {
  BillingProviderOption,
  CredentialFieldSchema,
  GatewayConnectionResponse,
  PaymentConfig,
} from "@/lib/api/payment";
import {
  useCreateGatewayConnection,
  useDeleteGatewayConnection,
  useGatewayConnections,
  usePaymentConfig,
  usePaymentProviders,
  useToggleGatewayConnectionActive,
  useUpdateGatewayConnection,
} from "@/lib/hooks/use-payment";
import { useCancelSubscription, useCurrentSubscription } from "@/lib/hooks/use-subscriptions";

/** Gateways this build supports. Anything else the API returns is hidden. */
const SUPPORTED_PROVIDERS = new Set(["STRIPE", "RAZORPAY"]);

/**
 * Production requires an active gateway; other environments do not.
 *
 * A store with no active gateway is a supported state, zero-payable orders
 * (a 100% coupon, a free item) settle without one, but it is only reachable
 * when the connection is switched off, so dev needs to be able to switch it off.
 *
 * Uses NEXT_PUBLIC_NODE_ENV, not NODE_ENV: a Next production BUILD sets
 * NODE_ENV="production" even on the dev deployment, which would wrongly block
 * it there. Matches how the rest of this app detects environment. The server
 * enforces the same rule via config.isProduction, this is only the UX half.
 */
const REQUIRE_ACTIVE_GATEWAY = process.env.NEXT_PUBLIC_NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Renders a gateway mode constant in human-readable form.
 * `SELF_MANAGED` -> "Self managed", `PLATFORM_MANAGED` -> "Platform managed".
 * Falls back to the raw value lower-cased so unexpected modes still read.
 */
function prettyMode(mode: string | null | undefined): string {
  if (!mode) return "";
  switch (mode.toUpperCase()) {
    case "SELF_MANAGED":
      return "Self managed";
    case "PLATFORM_MANAGED":
      return "Platform managed";
    default:
      return mode
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase());
  }
}

// ---------------------------------------------------------------------------
// Dynamic credential field renderer
// ---------------------------------------------------------------------------

function CredentialFields({
  schema,
  values,
  onChange,
}: {
  schema: CredentialFieldSchema[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  const toggleSecret = useCallback((key: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      {schema.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`cred_${field.key}`}>
            {field.label}
            {!field.required && (
              <span className="text-muted-foreground ml-1 text-xs">(optional)</span>
            )}
          </Label>
          {field.description && (
            <p className="text-muted-foreground text-xs">{field.description}</p>
          )}

          {field.type === "select" && field.options ? (
            <Select value={values[field.key] ?? ""} onValueChange={(v) => onChange(field.key, v)}>
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.type === "secret" ? (
            <div className="relative">
              <Input
                id={`cred_${field.key}`}
                type={visibleSecrets.has(field.key) ? "text" : "password"}
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                // Room for the reveal button, which sits on top of the field.
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                aria-label={visibleSecrets.has(field.key) ? `Hide ${field.label}` : `Show ${field.label}`}
                className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => toggleSecret(field.key)}
              >
                {visibleSecrets.has(field.key) ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          ) : (
            <Input
              id={`cred_${field.key}`}
              placeholder={field.placeholder}
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Numbered section heading for the connect dialog.
 *
 * The two panels are not interchangeable - the right one is empty until a
 * provider is chosen on the left, because the credential fields are generated
 * from that provider's schema. Numbering makes that order obvious instead of
 * leaving the user to discover it by clicking.
 */
function StepHeading({ step, title, hint }: { step: number; title: string; hint: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="bg-primary text-primary-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none">
          {step}
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connect Gateway Dialog
// ---------------------------------------------------------------------------

function ConnectGatewayDialog({
  open,
  onOpenChange,
  providers,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providers: BillingProviderOption[] | undefined;
}) {
  const { toast } = useToast();
  const createMutation = useCreateGatewayConnection();

  const [providerId, setProviderId] = useState("");
  const mode = "SELF_MANAGED" as const;
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");

  const selectedProvider = useMemo(
    () => providers?.find((p) => p.id === providerId) ?? null,
    [providers, providerId]
  );

  const credentialSchema = selectedProvider?.credential_schema ?? [];

  function handleProviderChange(id: string) {
    setProviderId(id);
    setCredentialValues({});
  }

  function handleCredentialChange(key: string, value: string) {
    setCredentialValues((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setProviderId("");
    setCredentialValues({});
    setLabel("");
  }

  async function handleSubmit() {
    if (!providerId) {
      toast({ title: "Select a provider", variant: "destructive" });
      return;
    }

    if (mode === "SELF_MANAGED" && credentialSchema.length > 0) {
      const missing = credentialSchema
        .filter((f) => f.required && !credentialValues[f.key]?.trim())
        .map((f) => f.label);
      if (missing.length > 0) {
        toast({
          title: `Missing required fields: ${missing.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }

    const credentials: Record<string, string> = {};
    for (const field of credentialSchema) {
      const val = credentialValues[field.key]?.trim();
      if (val) credentials[field.key] = val;
    }

    try {
      await createMutation.mutateAsync({
        provider_id: providerId,
        mode,
        label: label.trim() || null,
        credentials:
          mode === "SELF_MANAGED" && Object.keys(credentials).length > 0 ? credentials : null,
      });
      toast({ title: "Gateway connected successfully" });
      reset();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect gateway";
      toast({ title: message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Layout notes:
        - The shared DialogContent is vertically centred with no max-height, so
          tall content clips off BOTH ends with no way to scroll to it. Stripe
          has three credential fields with descriptions, which was enough to
          trigger it. Fixed here rather than in the shared component so no other
          dialog's sizing changes.
        - p-0 + an explicit header/body/footer split lets the body scroll while
          the title and the action buttons stay put.
        - Two columns on sm+: connection settings on the left, credentials on the
          right. That halves the height, which is what overflowed in the first
          place, and keeps related fields together.
      */}
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] flex-col gap-0 p-0 sm:w-full sm:max-w-3xl">
        {/* pr-12 keeps the title clear of the absolutely-positioned close button. */}
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Connect payment gateway</DialogTitle>
          <DialogDescription>
            Choose a provider and enter your API credentials. Credentials are encrypted at rest and
            never exposed in API responses.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {/*
            Column geometry: gap-x is ZERO and each column carries its own 2rem
            of inner padding instead. With `gap-x-8` the right column paid the
            gap AND its own `pl-8`, making it exactly 32px narrower than the
            left. Symmetric padding keeps both content boxes identical and puts
            the divider dead centre.
          */}
          <div className="grid gap-y-8 sm:grid-cols-2 sm:gap-x-0">
            {/* ── 1. Connection ──────────────────────────── */}
            <section className="space-y-5 sm:pr-8">
              <StepHeading
                step={1}
                title="Connection"
                hint="Start here. Choose the provider."
              />

              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={providerId} onValueChange={handleProviderChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">
                  Label <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="label"
                  placeholder="e.g. Production Razorpay"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Only shown to your team, to tell connections apart.
                </p>
              </div>
            </section>

            {/* ── 2. Credentials ─────────────────────────── */}
            {/* Divider is a left border on sm+; on mobile the columns stack, so
                it becomes a top border instead. */}
            <section className="space-y-5 border-t pt-8 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
              <StepHeading
                step={2}
                title="Credentials"
                hint="Then paste the keys from that provider's dashboard. They are encrypted before being stored."
              />

              {mode === "SELF_MANAGED" && credentialSchema.length > 0 && (
                <CredentialFields
                  schema={credentialSchema}
                  values={credentialValues}
                  onChange={handleCredentialChange}
                />
              )}

              {mode === "SELF_MANAGED" && credentialSchema.length === 0 && providerId && (
                <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                  No credential fields defined for this provider. Contact your platform admin to
                  configure the provider&apos;s credential schema.
                </p>
              )}

              {/* Placeholders so the column is never blank. Purely informational. */}
              {mode === "SELF_MANAGED" && !providerId && (
                <div className="text-muted-foreground flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm">
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  <span>Choose a provider in step 1 and its fields will appear here.</span>
                </div>
              )}

            </section>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Update Credentials Dialog
// ---------------------------------------------------------------------------

function UpdateCredentialsDialog({
  open,
  onOpenChange,
  connectionId,
  providerName,
  providers,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connectionId: string;
  providerName: string;
  providers: BillingProviderOption[] | undefined;
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateGatewayConnection(connectionId);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});

  const provider = useMemo(
    () => providers?.find((p) => p.name === providerName) ?? null,
    [providers, providerName]
  );

  const credentialSchema = provider?.credential_schema ?? [];

  function handleCredentialChange(key: string, value: string) {
    setCredentialValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (credentialSchema.length > 0) {
      const missing = credentialSchema
        .filter((f) => f.required && !credentialValues[f.key]?.trim())
        .map((f) => f.label);
      if (missing.length > 0) {
        toast({
          title: `Missing required fields: ${missing.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }

    const credentials: Record<string, string> = {};
    for (const field of credentialSchema) {
      const val = credentialValues[field.key]?.trim();
      if (val) credentials[field.key] = val;
    }

    if (Object.keys(credentials).length === 0) {
      toast({ title: "Enter at least one credential field", variant: "destructive" });
      return;
    }

    try {
      await updateMutation.mutateAsync({ credentials });
      toast({ title: "Credentials updated" });
      setCredentialValues({});
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update credentials";
      toast({ title: message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Same header/body/footer split as the connect dialog: without a
          max-height the shared DialogContent clips tall content off both ends. */}
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] flex-col gap-0 p-0 sm:w-full sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Update credentials for {providerName}</DialogTitle>
          <DialogDescription>
            Enter new API credentials. The old credentials will be replaced.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {credentialSchema.length > 0 ? (
            <CredentialFields
              schema={credentialSchema}
              values={credentialValues}
              onChange={handleCredentialChange}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              No credential schema defined for this provider. Contact your platform admin.
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Webhook Configuration Card
// ---------------------------------------------------------------------------

function CopyableUrlRow({ url, label }: { url: string; label?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: `${label ?? "URL"} copied to clipboard` });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Failed to copy", description: getErrorMessage(err), variant: "destructive" });
    }
  }, [url, label, toast]);

  return (
    <div className="space-y-1">
      {label && <p className="text-muted-foreground text-xs font-medium">{label}</p>}
      <div className="flex items-center gap-2">
        <Input readOnly value={url} className="font-mono text-sm" />
        <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function RazorpayWebhookCard({ url }: { url: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Razorpay Webhook Setup
        </CardTitle>
        <CardDescription>
          Add this URL as a webhook in your Razorpay dashboard to receive payment notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <CopyableUrlRow url={url} />
        <p className="text-muted-foreground text-xs">
          In your Razorpay Dashboard, go to Settings &rarr; Webhooks &rarr; Add New Webhook and paste this URL.
          Enable the <span className="font-medium">payment.captured</span> event for order payments.
          If you use user subscriptions, also enable subscription events (see Subscriptions &rarr; Settings for details).
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Stripe needs three events, not one, and the two async_payment_* ones are the
 * whole reason this card spells them out. Stripe's dashboard defaults to "send
 * me everything" or an empty selection, and a tenant who picks only
 * checkout.session.completed will take money for bank debits that never fulfil.
 */
const STRIPE_FALLBACK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
];

function StripeWebhookCard({ url, events }: { url: string; events?: string[] }) {
  const eventList = events?.length ? events : STRIPE_FALLBACK_EVENTS;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Stripe Webhook Setup
        </CardTitle>
        <CardDescription>
          Add this endpoint in your Stripe dashboard so payments are reflected here in real time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <CopyableUrlRow url={url} label="Endpoint URL" />
          <p className="text-muted-foreground pl-1 text-xs">
            In your Stripe Dashboard, go to{" "}
            <span className="font-medium">Developers &rarr; Webhooks &rarr; Add endpoint</span> and
            paste this URL.
          </p>
        </div>

        <div className="border-border/60 bg-muted/30 rounded-md border p-3 text-xs">
          <p className="text-foreground mb-1.5 font-medium">Select these events</p>
          <ul className="space-y-1">
            {eventList.map((event) => (
              <li key={event} className="text-muted-foreground font-mono">
                {event}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2">
            All three are required. Without the two{" "}
            <span className="font-medium">async_payment</span> events, slower payment methods such
            as bank debits would be charged but never completed on your store.
          </p>
        </div>

        <div className="border-border/60 bg-muted/30 rounded-md border p-3 text-xs text-muted-foreground">
          <p className="text-foreground mb-1 font-medium">Note</p>
          <p>
            After creating the endpoint, copy its{" "}
            <span className="font-medium">Signing secret</span> (starts with{" "}
            <span className="font-mono">whsec_</span>) and save it in the connection above. Payments
            cannot be verified without it.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function WebhookConfigSection({
  paymentConfig,
  connections,
}: {
  paymentConfig: PaymentConfig | undefined;
  connections: GatewayConnectionResponse[] | undefined;
}) {
  if (!paymentConfig || !connections) return null;
  const connectedProviders = new Set(connections.map((c) => c.provider_name.toUpperCase()));
  const razorpayUrl = paymentConfig.webhooks?.razorpay?.url ?? paymentConfig.razorpay_webhook_url;
  const stripe = paymentConfig.webhooks?.stripe;
  const cards: React.ReactNode[] = [];
  if (connectedProviders.has("RAZORPAY") && razorpayUrl) {
    cards.push(<RazorpayWebhookCard key="razorpay" url={razorpayUrl} />);
  }
  if (connectedProviders.has("STRIPE") && stripe) {
    cards.push(<StripeWebhookCard key="stripe" url={stripe.url} events={stripe.events} />);
  }
  if (cards.length === 0) return null;
  return <div className="md:col-span-2 grid gap-4 md:grid-cols-2">{cards}</div>;
}

export default function PaymentPage() {
  const { toast } = useToast();
  const { data: subscription } = useCurrentSubscription();
  const cancelSubscription = useCancelSubscription();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const { data: connections, isLoading: connectionsLoading } = useGatewayConnections();
  const { data: allProviders } = usePaymentProviders();
  const providers = useMemo(
    () => allProviders?.filter((p) => SUPPORTED_PROVIDERS.has(p.name.toUpperCase())),
    [allProviders]
  );
  const { data: paymentConfig } = usePaymentConfig();
  const deleteMutation = useDeleteGatewayConnection();
  const toggleActiveMutation = useToggleGatewayConnectionActive();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [updateCredsConn, setUpdateCredsConn] = useState<{
    id: string;
    providerName: string;
  } | null>(null);

  async function handleDisconnect(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Gateway disconnected" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect";
      toast({ title: message, variant: "destructive" });
    }
  }

  async function handleToggleActive(id: string, checked: boolean) {
    if (!checked && REQUIRE_ACTIVE_GATEWAY) {
      toast({
        title: "Cannot deactivate gateway",
        description: "Activate another gateway first, or delete this one if it's no longer needed.",
        variant: "destructive",
      });
      return;
    }
    try {
      await toggleActiveMutation.mutateAsync({ id, is_active: checked });
      toast({
        title: checked ? "Gateway activated" : "Gateway deactivated",
        description: checked
          ? undefined
          : "This store now has no active gateway. Only zero-payable orders will complete.",
      });
    } catch (err) {
      const message =
        getErrorMessage(err) ||
        `Failed to ${checked ? "activate" : "deactivate"} gateway`;
      toast({ title: message, variant: "destructive" });
    }
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment & Billing</h1>
          <p className="text-muted-foreground">
            Manage your platform subscription and the payment gateways your store uses.
          </p>
        </div>
        <TenantSelector />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Platform Subscription Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Platform subscription
                </CardTitle>
                <CardDescription>
                  Subscribe to a plan to unlock LMS features.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" asChild>
                  <Link href="/dashboard/plans">
                    {subscription ? "Change plan" : "View plans"}
                  </Link>
                </Button>
                {subscription &&
                  (subscription.status === "ACTIVE" || subscription.status === "TRIALING") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCancelDialogOpen(true)}
                      disabled={cancelSubscription.isPending}
                    >
                      {cancelSubscription.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Cancel
                    </Button>
                  )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{subscription.plan_name_snapshot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      subscription.status === "ACTIVE"
                        ? "default"
                        : subscription.status === "PAST_DUE"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {subscription.status === "PAST_DUE" ? "PAST DUE" : subscription.status}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current period ends</span>
                  <span>
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>

                {/* Dunning info when payment has failed */}
                {subscription.status === "PAST_DUE" && (
                  <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-destructive">Payment failed</p>
                        {subscription.payment_failure_count > 0 && (
                          <p className="text-muted-foreground">
                            Failed attempts: {subscription.payment_failure_count}
                          </p>
                        )}
                        {subscription.last_payment_attempt_at && (
                          <p className="text-muted-foreground">
                            Last attempt:{" "}
                            {new Date(subscription.last_payment_attempt_at).toLocaleDateString(
                              undefined,
                              { dateStyle: "medium" }
                            )}
                          </p>
                        )}
                        {subscription.grace_period_ends_at && (
                          <p className="text-muted-foreground">
                            Grace period ends:{" "}
                            <span className="font-medium text-destructive">
                              {new Date(subscription.grace_period_ends_at).toLocaleDateString(
                                undefined,
                                { dateStyle: "medium" }
                              )}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No active platform subscription. View plans to subscribe.
              </p>
            )}
          </CardContent>
        </Card>

        {cancelDialogOpen && subscription && (
          <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel subscription</DialogTitle>
                <DialogDescription>
                  Your subscription will end at the current period. You will lose access to plan
                  features after that. You can subscribe again anytime.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCancelDialogOpen(false)}
                  disabled={cancelSubscription.isPending}
                >
                  Keep subscription
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await cancelSubscription.mutateAsync(subscription.id);
                      setCancelDialogOpen(false);
                      toast({ title: "Subscription cancelled" });
                    } catch (err) {
                      toast({
                        title: err instanceof Error ? err.message : "Failed to cancel",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={cancelSubscription.isPending}
                >
                  {cancelSubscription.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Cancel subscription
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Gateway connections card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Gateway connections
                </CardTitle>
                <CardDescription>
                  Connected payment providers.
                </CardDescription>
              </div>
              <PermissionGate requires="gateway.configure">
                <Button
                  size="sm"
                  onClick={() => setConnectDialogOpen(true)}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Connect
                </Button>
              </PermissionGate>
            </div>
          </CardHeader>
          <CardContent>
            {connectionsLoading ? (
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : connections && connections.length > 0 ? (
              <ul className="space-y-3">
                {connections.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.provider_name}</span>
                        <Badge
                          variant={c.is_active ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {c.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {prettyMode(c.mode)}
                        {c.label ? `, ${c.label}` : ""}
                        {c.credentials_configured
                          ? " • Credentials set"
                          : " • No credentials"}
                      </div>
                    </div>
                    <PermissionGate requires="gateway.configure">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={(checked) => handleToggleActive(c.id, checked)}
                          disabled={toggleActiveMutation.isPending}
                          aria-label={c.is_active ? "Active gateway" : "Activate gateway"}
                        />
                        {c.mode === "SELF_MANAGED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setUpdateCredsConn({
                                id: c.id,
                                providerName: c.provider_name,
                              })
                            }
                          >
                            Update keys
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDisconnect(c.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </PermissionGate>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-4 text-center">
                <p className="text-muted-foreground mb-3">
                  No gateway connected yet. Connect Stripe or Razorpay to start accepting
                  payments from your users.
                </p>
                <PermissionGate requires="gateway.configure">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConnectDialogOpen(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Connect gateway
                  </Button>
                </PermissionGate>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook configuration cards (one per connected provider). */}
        <WebhookConfigSection paymentConfig={paymentConfig} connections={connections} />
      </div>

      {/* Dialogs */}
      <ConnectGatewayDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        providers={providers}
      />

      {updateCredsConn && (
        <UpdateCredentialsDialog
          open={!!updateCredsConn}
          onOpenChange={(v) => !v && setUpdateCredsConn(null)}
          connectionId={updateCredsConn.id}
          providerName={updateCredsConn.providerName}
          providers={providers}
        />
      )}
    </div>
  );
}
