"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import { getErrorMessage } from "@open-mtlms/shared";
import {
  BarChart3,
  Check,
  Copy,
  CreditCard,
  Edit,
  Globe,
  Layout,
  Loader2,
  Plus,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { SubscribePageTab } from "@/components/subscriptions/SubscribePageTab";
import type { SubscriptionPlan } from "@/lib/api/tenant-subscriptions";
import {
  useSubscriptionPlans,
  useCreateSubscriptionPlan,
  useUpdateSubscriptionPlan,
  useDeactivateSubscriptionPlan,
  useSubscriptionSettings,
  useUpdateSubscriptionSettings,
  useSubscriptionWebhookConfig,
} from "@/lib/hooks/use-tenant-subscriptions";

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatAmount(amount: string, currency: string) {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  const symbols: Record<string, string> = { INR: "\u20B9", USD: "$", EUR: "\u20AC", GBP: "\u00A3" };
  const symbol = symbols[currency.toUpperCase()] ?? currency + " ";
  return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PlanStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge className="border-green-300 bg-green-50 text-green-700" variant="outline">
      Active
    </Badge>
  ) : (
    <Badge className="border-red-300 bg-red-50 text-red-700" variant="outline">
      Inactive
    </Badge>
  );
}

// ─── Plans Tab ───────────────────────────────────────────────────────────

function PlansTab() {
  const { toast } = useToast();
  const { data: plans, isLoading } = useSubscriptionPlans(true);
  const { data: settings } = useSubscriptionSettings();
  const createPlan = useCreateSubscriptionPlan();
  const updatePlan = useUpdateSubscriptionPlan();
  const deactivatePlan = useDeactivateSubscriptionPlan();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBillingCycle, setFormBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [formCurrency, setFormCurrency] = useState("INR");
  const [formAmount, setFormAmount] = useState("");
  const [formFeaturesSummary, setFormFeaturesSummary] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFeaturesSummary, setEditFeaturesSummary] = useState("");

  const resetCreateForm = () => {
    setFormName("");
    setFormDescription("");
    setFormBillingCycle("MONTHLY");
    setFormCurrency("INR");
    setFormAmount("");
    setFormFeaturesSummary("");
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setEditName(plan.name);
    setEditDescription(plan.description ?? "");
    setEditFeaturesSummary(plan.features_summary ?? "");
  };

  const handleCreate = (deactivateConflicting = false) => {
    if (!formName.trim() || !formAmount) return;
    createPlan.mutate(
      {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        billing_cycle: formBillingCycle,
        currency: formCurrency,
        amount: parseFloat(formAmount),
        features_summary: formFeaturesSummary.trim() || undefined,
        deactivate_conflicting: deactivateConflicting || undefined,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setConflictMessage(null);
          resetCreateForm();
          toast({ title: "Success", description: "Plan created successfully." });
        },
        onError: (err: any) => {
          // Detect 409 conflict, show confirmation dialog
          const status = err?.status;
          if (status === 409) {
            const message = err?.message ?? "A conflicting plan exists.";
            setConflictMessage(message);
            return;
          }
          toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleUpdate = () => {
    if (!editingPlan) return;
    updatePlan.mutate(
      {
        id: editingPlan.id,
        name: editName.trim() || undefined,
        description: editDescription.trim() || undefined,
        features_summary: editFeaturesSummary.trim() || undefined,
      },
      {
        onSuccess: () => {
          setEditingPlan(null);
          toast({ title: "Success", description: "Plan updated successfully." });
        },
        onError: (err: Error) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleDeactivate = (id: string) => {
    deactivatePlan.mutate(id, {
      onSuccess: () => {
        toast({ title: "Success", description: "Plan deactivated successfully." });
      },
      onError: (err: Error) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Header with subscription name + Create button */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          {settings?.subscription_name && (
            <h2 className="text-lg font-semibold">{settings.subscription_name}</h2>
          )}
        </div>
        <Button onClick={() => { resetCreateForm(); setIsCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Create Plan
        </Button>
      </div>

      {(!plans || plans.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">No subscription plans yet</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Create your first plan to start accepting subscriptions.
            </p>
          </CardContent>
        </Card>
      )}

      {plans && plans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {plan.billing_cycle === "MONTHLY" ? "Monthly" : "Yearly"} billing
                    </CardDescription>
                  </div>
                  <PlanStatusBadge isActive={plan.is_active} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold">
                  {formatAmount(plan.amount, plan.currency)}
                  <span className="text-muted-foreground text-sm font-normal">
                    /{plan.billing_cycle === "MONTHLY" ? "mo" : "yr"}
                  </span>
                </div>
                {plan.description && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">{plan.description}</p>
                )}
                {plan.trial_days > 0 && (
                  <p className="text-sm text-blue-600">{plan.trial_days}-day free trial</p>
                )}
                {plan.features_summary && (
                  <p className="text-muted-foreground line-clamp-3 text-xs whitespace-pre-line">
                    {plan.features_summary}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {plan.subscriber_count ?? 0} subscriber{(plan.subscriber_count ?? 0) !== 1 ? "s" : ""}
                </div>
              </CardContent>
              <CardFooter className="gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(plan)}>
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                {plan.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeactivate(plan.id)}
                    disabled={deactivatePlan.isPending}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Deactivate
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Subscription Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan-name">Name *</Label>
              <Input
                id="plan-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Pro Monthly"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-desc">Description</Label>
              <Textarea
                id="plan-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief plan description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-cycle">Billing Cycle *</Label>
                <Select value={formBillingCycle} onValueChange={(v) => setFormBillingCycle(v as "MONTHLY" | "YEARLY")}>
                  <SelectTrigger id="plan-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-currency">Currency *</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger id="plan-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-amount">Amount *</Label>
              <Input
                id="plan-amount"
                type="number"
                min="0"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="499.00"
              />
              <p className="text-muted-foreground text-xs">
                Price should be inclusive of all applicable taxes. No additional taxes will be charged.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-features">Features Summary</Label>
              <Textarea
                id="plan-features"
                value={formFeaturesSummary}
                onChange={(e) => setFormFeaturesSummary(e.target.value)}
                placeholder="List key features, one per line"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleCreate()}
              disabled={createPlan.isPending || !formName.trim() || !formAmount}
            >
              {createPlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog
        open={!!editingPlan}
        onOpenChange={(open) => { if (!open) setEditingPlan(null); }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-features">Features Summary</Label>
              <Textarea
                id="edit-features"
                value={editFeaturesSummary}
                onChange={(e) => setEditFeaturesSummary(e.target.value)}
                rows={3}
              />
            </div>
            {editingPlan && (
              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                <p>
                  <strong>Billing Cycle:</strong>{" "}
                  {editingPlan.billing_cycle === "MONTHLY" ? "Monthly" : "Yearly"}
                </p>
                <p>
                  <strong>Amount:</strong>{" "}
                  {formatAmount(editingPlan.amount, editingPlan.currency)}
                </p>
                <p className="mt-1 text-xs">
                  Billing cycle and amount cannot be changed after creation. Create a new plan instead.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updatePlan.isPending}>
              {updatePlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict Confirmation Dialog */}
      <AlertDialog
        open={!!conflictMessage}
        onOpenChange={(open) => { if (!open) setConflictMessage(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conflicting Plan Exists</AlertDialogTitle>
            <AlertDialogDescription>{conflictMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConflictMessage(null);
                handleCreate(true);
              }}
            >
              Deactivate &amp; Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────────

function SettingsTab() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useSubscriptionSettings();
  const updateSettings = useUpdateSubscriptionSettings();

  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [gracePeriod, setGracePeriod] = useState("");
  const [reminderDays, setReminderDays] = useState("");
  const [dunningInterval, setDunningInterval] = useState("");
  const [subscriptionName, setSubscriptionName] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialize form from fetched data
  if (settings && !initialized) {
    setIsEnabled(settings.is_enabled);
    setGracePeriod(String(settings.grace_period_days));
    setReminderDays(settings.reminder_days_before?.join(", ") ?? "");
    setDunningInterval(String(settings.dunning_email_interval_hours));
    setSubscriptionName(settings.subscription_name ?? "");
    setInitialized(true);
  }

  const handleSave = () => {
    const parsedReminder = reminderDays.trim()
      ? reminderDays
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
      : null;

    updateSettings.mutate(
      {
        is_enabled: isEnabled ?? false,
        grace_period_days: parseInt(gracePeriod, 10) || 0,
        reminder_days_before: parsedReminder,
        dunning_email_interval_hours: parseInt(dunningInterval, 10) || 24,
        subscription_name: subscriptionName.trim() || null,
      },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Settings updated successfully." });
        },
        onError: (err: Error) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Settings</CardTitle>
        <CardDescription>
          Configure how user subscriptions work for your platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="subscription-name">Subscription Name</Label>
          <Input
            id="subscription-name"
            value={subscriptionName}
            onChange={(e) => setSubscriptionName(e.target.value)}
            placeholder="e.g. X Academy Plus"
            maxLength={100}
          />
          <p className="text-muted-foreground text-xs">
            The brand name shown to users on the subscribe page.
          </p>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Enable User Subscriptions</p>
            <p className="text-muted-foreground text-sm">
              Allow users to subscribe to recurring plans on your platform.
            </p>
          </div>
          <Switch
            checked={isEnabled ?? false}
            onCheckedChange={setIsEnabled}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="grace-period">Grace Period (days)</Label>
            <Input
              id="grace-period"
              type="number"
              min="0"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(e.target.value)}
              placeholder="3"
            />
            <p className="text-muted-foreground text-xs">
              Days to keep access active after a failed payment.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dunning-interval">Dunning Email Interval (hours)</Label>
            <Input
              id="dunning-interval"
              type="number"
              min="1"
              value={dunningInterval}
              onChange={(e) => setDunningInterval(e.target.value)}
              placeholder="24"
            />
            <p className="text-muted-foreground text-xs">
              Hours between dunning emails for failed payments.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reminder-days">Reminder Days Before Renewal</Label>
          <Input
            id="reminder-days"
            value={reminderDays}
            onChange={(e) => setReminderDays(e.target.value)}
            placeholder="7, 3, 1"
          />
          <p className="text-muted-foreground text-xs">
            Comma-separated days before renewal to send reminder emails (e.g. 7, 3, 1).
          </p>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </CardFooter>
    </Card>
  );
}

// ─── Webhook Setup Card ──────────────────────────────────────────────────

function WebhookSetupCard() {
  const { toast } = useToast();
  const { data: webhookConfig, isLoading } = useSubscriptionWebhookConfig();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!webhookConfig?.webhook_url) return;
    try {
      await navigator.clipboard.writeText(webhookConfig.webhook_url);
      setCopied(true);
      toast({ title: "Webhook URL copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }, [webhookConfig?.webhook_url, toast]);

  if (isLoading || !webhookConfig) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Subscription Webhook Setup
        </CardTitle>
        <CardDescription>
          Add this webhook URL and secret in your Razorpay Dashboard to enable automatic subscription lifecycle management.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Webhook URL</Label>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={webhookConfig.webhook_url}
              className="font-mono text-sm"
            />
            <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="rounded-md bg-muted/50 p-4 text-sm space-y-2">
          <p className="font-medium">Setup Instructions:</p>
          <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
            <li>Go to your Razorpay Dashboard &rarr; Settings &rarr; Webhooks</li>
            <li>Click &quot;Add New Webhook&quot; and paste the URL above</li>
            <li>
              Create a webhook secret and add it to your Payment Gateway credentials
              (Payment &amp; Billing &rarr; Update Credentials &rarr; Webhook Secret)
            </li>
            <li>
              Enable these subscription events:
              <ul className="list-disc pl-4 mt-1">
                {webhookConfig.required_events.map((event) => (
                  <li key={event}>{event}</li>
                ))}
              </ul>
            </li>
            <li>Save the webhook configuration</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage subscription plans and settings for your users.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/subscriptions/subscribers">
            <BarChart3 className="mr-2 h-4 w-4" />
            Subscribers & Analytics
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="page" className="gap-2">
            <Layout className="h-4 w-4" />
            Subscribe Page
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <PlansTab />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
          <WebhookSetupCard />
        </TabsContent>

        <TabsContent value="page">
          <SubscribePageTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
