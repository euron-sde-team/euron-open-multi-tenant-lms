"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Switch, useToast } from "@open-mtlms/core";
import { Check, ChevronDown, ChevronUp, ExternalLink, KeyRound, Loader2, Mail, MessageCircle, Phone, Settings, Shield, Trash2, UserCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuthConfig, useClearGoogleClientId, useSaveGoogleClientId, useUpdateAuthConfig } from "@/lib/hooks/use-auth-config";
import { useTenantStore } from "@/lib/stores/tenant-store";

export default function AuthenticationSettingsPage() {
  const { selectedTenantId } = useTenantStore();
  const { data: config, isLoading } = useAuthConfig(selectedTenantId ?? undefined);
  const updateConfig = useUpdateAuthConfig(selectedTenantId ?? undefined);
  const saveClientId = useSaveGoogleClientId(selectedTenantId ?? undefined);
  const clearClientId = useClearGoogleClientId(selectedTenantId ?? undefined);
  const { toast } = useToast();

  const [emailPasswordEnabled, setEmailPasswordEnabled] = useState(true);
  const [googleOauthEnabled, setGoogleOauthEnabled] = useState(false);
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(false);
  const [phoneOtpEnabled, setPhoneOtpEnabled] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [autoSignupOnLogin, setAutoSignupOnLogin] = useState(false);
  const [phoneNumberRequired, setPhoneNumberRequired] = useState(false);
  const [easyCheckoutEnabled, setEasyCheckoutEnabled] = useState(false);
  const [nameConfirmationEnabled, setNameConfirmationEnabled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Google OAuth Client ID form state
  const [showClientIdForm, setShowClientIdForm] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (config) {
      setEmailPasswordEnabled(config.emailPasswordEnabled);
      setGoogleOauthEnabled(config.googleOauthEnabled);
      setEmailOtpEnabled(config.emailOtpEnabled);
      setPhoneOtpEnabled(config.phoneOtpEnabled);
      setSignupEnabled(config.signupEnabled);
      setAutoSignupOnLogin(config.autoSignupOnLogin);
      setPhoneNumberRequired(config.phoneNumberRequired ?? false);
      setEasyCheckoutEnabled(config.easyCheckoutEnabled ?? false);
      setNameConfirmationEnabled(config.nameConfirmationEnabled ?? false);
      setIsDirty(false);
    }
  }, [config]);

  const handleToggle = (
    setter: (v: boolean) => void,
    value: boolean
  ) => {
    setter(value);
    setIsDirty(true);
  };

  const handleEasyCheckoutToggle = (value: boolean) => {
    setEasyCheckoutEnabled(value);
    if (value) {
      // Easy Checkout requires both OTP login methods (auto-created accounts have no
      // password and must come back via OTP). Backend enforces the same rule.
      setEmailOtpEnabled(true);
      setPhoneOtpEnabled(true);
    }
    setIsDirty(true);
  };

  const handleGoogleOauthToggle = (value: boolean) => {
    if (value && !config?.googleClientId) {
      toast({
        title: "Client ID Required",
        description: "Please configure your Google Client ID first.",
        variant: "destructive",
      });
      return;
    }
    handleToggle(setGoogleOauthEnabled, value);
  };

  const handleSignupModeChange = (mode: "separate" | "auto") => {
    if (mode === "separate") {
      setSignupEnabled(true);
      setAutoSignupOnLogin(false);
    } else {
      setSignupEnabled(false);
      setAutoSignupOnLogin(true);
    }
    setIsDirty(true);
  };

  const hasAtLeastOneMethod =
    emailPasswordEnabled || googleOauthEnabled || emailOtpEnabled || phoneOtpEnabled;

  const handleSave = () => {
    if (!hasAtLeastOneMethod) {
      toast({
        title: "Validation Error",
        description: "At least one authentication method must be enabled.",
        variant: "destructive",
      });
      return;
    }

    updateConfig.mutate(
      {
        emailPasswordEnabled,
        googleOauthEnabled,
        emailOtpEnabled,
        phoneOtpEnabled,
        signupEnabled,
        autoSignupOnLogin,
        phoneNumberRequired,
        easyCheckoutEnabled,
        nameConfirmationEnabled,
      },
      {
        onSuccess: (result) => {
          setIsDirty(false);
          // Surface backend-emitted warnings (e.g. "Email OTP and Phone OTP
          // were enabled because Easy Checkout requires both for account
          // recovery.") so the admin understands what was auto-flipped on
          // their behalf.
          if (result.warnings && result.warnings.length > 0) {
            toast({
              title: "Settings Saved (with adjustments)",
              description: result.warnings.join(" "),
            });
          } else {
            toast({
              title: "Settings Saved",
              description: "Authentication settings have been updated.",
            });
          }
        },
        onError: (error) => {
          toast({
            title: "Save Failed",
            description:
              error.message || "Failed to update authentication settings.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleSaveClientId = () => {
    if (!googleClientId.trim()) {
      toast({
        title: "Validation Error",
        description: "Google Client ID is required.",
        variant: "destructive",
      });
      return;
    }

    saveClientId.mutate(
      { googleClientId: googleClientId.trim() },
      {
        onSuccess: () => {
          setShowClientIdForm(false);
          setGoogleClientId("");
          toast({
            title: "Client ID Saved",
            description: "Google OAuth Client ID has been configured successfully.",
          });
        },
        onError: (error) => {
          toast({
            title: "Save Failed",
            description:
              error.message || "Failed to save Google Client ID.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleClearClientId = () => {
    clearClientId.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Client ID Removed",
          description: "Google OAuth Client ID has been removed.",
        });
      },
      onError: (error) => {
        toast({
          title: "Remove Failed",
          description:
            error.message || "Failed to remove Google Client ID.",
          variant: "destructive",
        });
      },
    });
  };

  const handleCancelClientIdForm = () => {
    setShowClientIdForm(false);
    setGoogleClientId("");
  };

  const maskedClientId = config?.googleClientId
    ? config.googleClientId.length > 20
      ? config.googleClientId.slice(0, 20) + "..."
      : config.googleClientId
    : null;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const signupMode: "separate" | "auto" =
    signupEnabled && !autoSignupOnLogin ? "separate" : "auto";

  const clientIdConfigured = !!config?.googleClientId;

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Authentication</h1>
        <p className="text-muted-foreground">
          Configure how your users sign in and sign up to your platform.
        </p>
      </div>

      <div className="space-y-6">
        {/* Auth Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Authentication Methods</CardTitle>
            <CardDescription>
              Choose which sign-in methods are available to your users. At least
              one method must be enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email & Password */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    Email &amp; Password
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Traditional email and password authentication
                  </p>
                </div>
              </div>
              <Switch
                checked={emailPasswordEnabled}
                onCheckedChange={(v) =>
                  handleToggle(setEmailPasswordEnabled, v)
                }
              />
            </div>

            {/* Google OAuth */}
            <div className="rounded-lg border">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Google OAuth</Label>
                    <p className="text-muted-foreground text-xs">
                      Allow users to sign in with their Google account
                    </p>
                  </div>
                </div>
                <Switch
                  checked={googleOauthEnabled}
                  disabled={!clientIdConfigured}
                  onCheckedChange={handleGoogleOauthToggle}
                />
              </div>

              {/* No Client ID configured */}
              {!clientIdConfigured && !showClientIdForm && (
                <div className="border-t px-4 py-3">
                  <p className="text-muted-foreground mb-3 text-sm">
                    To enable Google Sign-In, configure your Google OAuth Client ID below.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClientIdForm(true)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Configure
                  </Button>
                </div>
              )}

              {/* Client ID configured */}
              {clientIdConfigured && !showClientIdForm && (
                <div className="border-t px-4 py-3">
                  <div className="space-y-2">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Client ID
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <p className="font-mono text-sm">
                          {maskedClientId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowClientIdForm(true)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Update Client ID
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={clearClientId.isPending}
                        onClick={handleClearClientId}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {clearClientId.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Client ID Form (inline, expandable) */}
              {showClientIdForm && (
                <div className="border-t px-4 py-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="google-client-id" className="text-sm font-medium">
                        Google Client ID
                      </Label>
                      <Input
                        id="google-client-id"
                        type="text"
                        placeholder="123456789-abc.apps.googleusercontent.com"
                        value={googleClientId}
                        onChange={(e) => setGoogleClientId(e.target.value)}
                      />
                    </div>

                    {/* Setup instructions */}
                    <div className="rounded-lg border bg-muted/30">
                      <button
                        type="button"
                        onClick={() => setShowInstructions(!showInstructions)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
                      >
                        <span>How to get your Google Client ID</span>
                        {showInstructions ? (
                          <ChevronUp className="text-muted-foreground h-4 w-4" />
                        ) : (
                          <ChevronDown className="text-muted-foreground h-4 w-4" />
                        )}
                      </button>
                      {showInstructions && (
                        <div className="border-t px-4 py-3">
                          <ol className="text-muted-foreground list-decimal space-y-1.5 pl-4 text-sm">
                            <li>
                              Go to{" "}
                              <a
                                href="https://console.cloud.google.com/apis/credentials"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                Google Cloud Console &gt; APIs &amp; Services &gt; Credentials
                                <ExternalLink className="ml-0.5 inline h-3 w-3" />
                              </a>
                            </li>
                            <li>Create a new project or select an existing one</li>
                            <li>
                              Configure the <strong>OAuth consent screen</strong>, choose{" "}
                              <strong>&quot;External&quot;</strong>, add your app name, logo, and domain
                            </li>
                            <li>
                              Go to{" "}
                              <strong>Credentials &gt; Create Credentials &gt; OAuth 2.0 Client ID</strong>
                            </li>
                            <li>
                              Select <strong>&quot;Web application&quot;</strong> as the application type
                            </li>
                            <li>
                              Add your platform domain to{" "}
                              <strong>&quot;Authorized JavaScript origins&quot;</strong>{" "}
                              (e.g., <code className="rounded bg-muted px-1 text-xs">https://your-academy.example.com</code>)
                            </li>
                            <li>
                              Add the same domain to{" "}
                              <strong>&quot;Authorized redirect URIs&quot;</strong>
                            </li>
                            <li>Copy the generated <strong>Client ID</strong> and paste it above</li>
                          </ol>
                          <a
                            href="https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary mt-3 inline-flex items-center gap-1 text-sm hover:underline"
                          >
                            Google&apos;s official documentation
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveClientId}
                        disabled={!googleClientId.trim() || saveClientId.isPending}
                      >
                        {saveClientId.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save Client ID
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelClientIdForm}
                        disabled={saveClientId.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Email OTP */}
            <div
              className="flex items-center justify-between rounded-lg border p-4"
              title={easyCheckoutEnabled ? "Required by Easy Checkout" : undefined}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Email OTP</Label>
                  <p className="text-muted-foreground text-xs">
                    {easyCheckoutEnabled
                      ? "Locked on. Required by Easy Checkout."
                      : "Passwordless sign-in via email verification code"}
                  </p>
                </div>
              </div>
              <Switch
                checked={emailOtpEnabled}
                disabled={easyCheckoutEnabled}
                onCheckedChange={(v) =>
                  handleToggle(setEmailOtpEnabled, v)
                }
              />
            </div>

            {/* Phone OTP via WhatsApp */}
            <div
              className="flex items-center justify-between rounded-lg border p-4"
              title={easyCheckoutEnabled ? "Required by Easy Checkout" : undefined}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    Phone OTP (WhatsApp)
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {easyCheckoutEnabled
                      ? "Locked on. Required by Easy Checkout."
                      : "Passwordless sign-in via WhatsApp verification code"}
                  </p>
                </div>
              </div>
              <Switch
                checked={phoneOtpEnabled}
                disabled={easyCheckoutEnabled}
                onCheckedChange={(v) =>
                  handleToggle(setPhoneOtpEnabled, v)
                }
              />
            </div>

            {!hasAtLeastOneMethod && (
              <p className="text-sm text-red-500">
                At least one authentication method must be enabled.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Signup Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Signup Mode
            </CardTitle>
            <CardDescription>
              Control how new users register on your platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                signupMode === "separate"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="signupMode"
                value="separate"
                checked={signupMode === "separate"}
                onChange={() => handleSignupModeChange("separate")}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium">
                  Separate Login &amp; Signup
                </p>
                <p className="text-muted-foreground text-xs">
                  Users see distinct login and signup forms. New users must
                  explicitly sign up before they can log in.
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                signupMode === "auto"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="signupMode"
                value="auto"
                checked={signupMode === "auto"}
                onChange={() => handleSignupModeChange("auto")}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium">
                  Login Only (Auto-signup)
                </p>
                <p className="text-muted-foreground text-xs">
                  Only a login form is shown. First-time users are automatically
                  registered when they log in for the first time.
                </p>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Easy Checkout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5" />
              Easy Checkout
            </CardTitle>
            <CardDescription>
              Let logged-out shoppers buy in one step. They enter their email and phone, we
              create their account automatically, and the purchase goes through. They can
              come back later by logging in via OTP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">
                Heads up: Easy Checkout creates accounts without verification.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-foreground/80">
                <li>
                  When a logged-out shopper enters an unused email and phone, we create the
                  account on the spot, no OTP, no password.
                </li>
                <li>
                  Because there is no password, those accounts can only sign back in later
                  via Email OTP or Phone OTP. Both channels are auto-enabled when you turn
                  Easy Checkout on, and stay locked while it is on.
                </li>
                <li>
                  You take on the trade-off of unverified pre-claimed accounts (someone
                  could enter another person&apos;s identifiers). Use rate limits and abuse
                  monitoring accordingly.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Enable Easy Checkout</Label>
                  <p className="text-muted-foreground text-xs">
                    Turning this on automatically enables Email OTP and Phone OTP login,
                    since auto-created accounts come back via OTP.
                  </p>
                </div>
              </div>
              <Switch
                checked={easyCheckoutEnabled}
                onCheckedChange={handleEasyCheckoutToggle}
              />
            </div>
          </CardContent>
        </Card>

        {/* Phone Number Requirement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5" />
              Phone Number Requirement
            </CardTitle>
            <CardDescription>
              Require users to verify their phone number after logging in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Require Phone Verification</Label>
                  <p className="text-muted-foreground text-xs">
                    Users must verify their phone via WhatsApp OTP before accessing content
                  </p>
                </div>
              </div>
              <Switch
                checked={phoneNumberRequired}
                onCheckedChange={(v) => handleToggle(setPhoneNumberRequired, v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Name Confirmation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5" />
              Name Confirmation
            </CardTitle>
            <CardDescription>
              Ask users to confirm or update their name once after they log in.
              Helpful when names are auto filled from an email or phone number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Show name confirmation modal</Label>
                  <p className="text-muted-foreground text-xs">
                    Shown once. Users confirm their name, and phone based accounts can
                    also set a real email (verified by code). It never shows again after
                    they confirm.
                  </p>
                </div>
              </div>
              <Switch
                checked={nameConfirmationEnabled}
                onCheckedChange={(v) => handleToggle(setNameConfirmationEnabled, v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!isDirty || !hasAtLeastOneMethod || updateConfig.isPending}
          >
            {updateConfig.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
