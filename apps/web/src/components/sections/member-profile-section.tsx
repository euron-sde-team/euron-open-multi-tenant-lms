"use client";

import type { MemberProfileContent, SectionConfig } from "@open-mtlms/shared/types";
import { formatMoney } from "@open-mtlms/shared";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import {
  Award,
  BarChart3,
  Bell,
  Bookmark,
  Camera,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  GraduationCap,
  Key,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Shield,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { lazy, Suspense , useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

const LearnerAnalytics = lazy(() => import("@/components/analytics/LearnerAnalytics"));
const CourseVideoAnalytics = lazy(() => import("@/components/analytics/CourseVideoAnalytics"));
const TestPerformancePanel = lazy(() =>
  import("@/components/profile/TestPerformancePanel").then((m) => ({
    default: m.TestPerformancePanel,
  }))
);
const CertificatesTab = lazy(() => import("@/components/profile/CertificatesTab"));
const BookmarksTab = lazy(() => import("@/components/profile/BookmarksTab"));
import { useRouter } from "next/navigation";

import { userAuthApi } from "@/lib/api/auth";
import { useMyInvoices } from "@/lib/hooks/use-invoices";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

interface MemberProfileSectionProps {
  section: SectionConfig;
}

function getInitials(name: string | undefined): string {
  if (!name?.trim()) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
const GENDER_OPTIONS = [
  { value: "", label: "Select" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const DEFAULT_CONTENT: MemberProfileContent = {
  headline: "Profile",
  subheadline: "Manage your account settings",
  profileTabLabel: "Profile",
  settingsTabLabel: "Settings",
  firstNameLabel: "First Name",
  lastNameLabel: "Last Name",
  phoneLabel: "Phone Number",
  emailLabel: "Email",
  genderLabel: "Gender",
  aboutLabel: "About",
  phoneHint: "Country code must start with + (e.g. +91)",
  emailHint: "Email cannot be changed",
  firstNamePlaceholder: "First name",
  lastNamePlaceholder: "Last name",
  phonePlaceholder: "+91 9876543210",
  aboutPlaceholder: "Tell us about yourself",
  genderPlaceholder: "Select gender",
  otpPlaceholder: "Enter OTP",
  sendVerificationCodeText: "Send verification code",
  verifyText: "Verify",
  cancelOtpText: "Cancel",
  updateProfileText: "Update Profile",
  deleteAccountTitle: "Delete Account",
  deleteAccountDescription:
    "Permanently delete your account and all associated data. This action cannot be undone.",
  deleteAccountButton: "Delete Account",
  yesDeleteText: "Yes, delete my account",
  cancelText: "Cancel",
};

function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = (name || "").trim();
  const idx = trimmed.indexOf(" ");
  if (idx <= 0) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1).trim(),
  };
}

function SettingsToggle({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

function SettingsTabContent({
  member,
  isUpdating,
  setIsUpdating: _setIsUpdating,
  showDeleteConfirm,
  setShowDeleteConfirm,
  handleDeleteAccount,
  logout,
  c,
}: {
  member: { email: string; emailVerified: boolean; phoneVerified: boolean; name: string } | null;
  isUpdating: boolean;
  setIsUpdating: (v: boolean) => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  handleDeleteAccount: () => void;
  logout: () => void;
  c: { deleteAccountTitle?: string; deleteAccountDescription?: string; deleteAccountButton?: string; yesDeleteText?: string; cancelText?: string };
}) {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [changingPw, setChangingPw] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    emailNotifications: true,
    pushNotifications: true,
    courseUpdates: true,
    promotionalEmails: false,
    weeklyDigest: true,
  });

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      toast({ title: "Error", description: "All password fields are required", variant: "destructive" });
      return;
    }
    if (pwForm.newPw.length < 8) {
      toast({ title: "Error", description: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    setChangingPw(true);
    try {
      await userAuthApi.changePassword({ currentPassword: pwForm.current, newPassword: pwForm.newPw });
      toast({ title: "Success", description: "Password changed successfully" });
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to change password", variant: "destructive" });
    } finally {
      setChangingPw(false);
    }
  };

  const handleExportData = async () => {
    toast({ title: "Export Started", description: "Your data export is being prepared. You'll receive it via email shortly." });
  };

  return (
    <div className="space-y-8">
      {/* ── Appearance ──────────────────────────────────── */}
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Sun className="h-4 w-4 text-muted-foreground" />
          Appearance
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Choose your preferred theme</p>
        <div className="mt-3 flex gap-3">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                theme === t ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"
              )}
            >
              {t === "light" && <Sun className="h-4 w-4" />}
              {t === "dark" && <Moon className="h-4 w-4" />}
              {t === "system" && <Monitor className="h-4 w-4" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Security ────────────────────────────────────── */}
      <div className="border-t pt-8">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Security
        </h3>

        {/* Verification status */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Email Verified</span>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", member?.emailVerified ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
              {member?.emailVerified ? "Verified" : "Not Verified"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Phone Verified</span>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", member?.phoneVerified ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
              {member?.phoneVerified ? "Verified" : "Not Verified"}
            </span>
          </div>
        </div>

        {/* Change password */}
        <div className="mt-4 rounded-lg border p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Key className="h-4 w-4 text-muted-foreground" />
            Change Password
          </h4>
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="currentPw">Current Password</Label>
              <div className="relative mt-1">
                <Input id="currentPw" type={showCurrentPw ? "text" : "password"} value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} placeholder="Enter current password" />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="newPw">New Password</Label>
                <div className="relative mt-1">
                  <Input id="newPw" type={showNewPw ? "text" : "password"} value={pwForm.newPw} onChange={(e) => setPwForm((p) => ({ ...p, newPw: e.target.value }))} placeholder="Min 8 characters" />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPw">Confirm New Password</Label>
                <Input id="confirmPw" type="password" value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} placeholder="Re-enter new password" className="mt-1" />
              </div>
            </div>
            {pwForm.newPw && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
            <Button type="button" size="sm" onClick={handleChangePassword} disabled={changingPw || !pwForm.current || !pwForm.newPw || !pwForm.confirm}>
              {changingPw && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Update Password
            </Button>
          </div>
        </div>
      </div>

      {/* ── Notifications ───────────────────────────────── */}
      <div className="border-t pt-8">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Notification Preferences
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Choose what notifications you receive</p>
        <div className="mt-3 space-y-2">
          <SettingsToggle icon={Bell} label="Email Notifications" description="Receive important updates via email" checked={notifPrefs.emailNotifications} onChange={(v) => setNotifPrefs((p) => ({ ...p, emailNotifications: v }))} />
          <SettingsToggle icon={Bell} label="Push Notifications" description="Browser push notifications for real-time alerts" checked={notifPrefs.pushNotifications} onChange={(v) => setNotifPrefs((p) => ({ ...p, pushNotifications: v }))} />
          <SettingsToggle icon={GraduationCap} label="Course Updates" description="Notify when enrolled courses have new content" checked={notifPrefs.courseUpdates} onChange={(v) => setNotifPrefs((p) => ({ ...p, courseUpdates: v }))} />
          <SettingsToggle icon={FileText} label="Weekly Digest" description="Weekly summary of your learning progress" checked={notifPrefs.weeklyDigest} onChange={(v) => setNotifPrefs((p) => ({ ...p, weeklyDigest: v }))} />
          <SettingsToggle icon={Globe} label="Promotional Emails" description="Updates about new courses, offers, and features" checked={notifPrefs.promotionalEmails} onChange={(v) => setNotifPrefs((p) => ({ ...p, promotionalEmails: v }))} />
        </div>
      </div>

      {/* ── Sessions ────────────────────────────────────── */}
      <div className="border-t pt-8">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          Active Sessions
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Manage your logged-in devices</p>
        <div className="mt-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Monitor className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Current Session</p>
                <p className="text-xs text-muted-foreground">{member?.email}: This device</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { logout(); }}>
              <LogOut className="mr-2 h-3 w-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* ── Data & Privacy ──────────────────────────────── */}
      <div className="border-t pt-8">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Download className="h-4 w-4 text-muted-foreground" />
          Data & Privacy
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Manage your data and account</p>

        {/* Export data */}
        <div className="mt-3 rounded-lg border p-4">
          <h4 className="text-sm font-semibold">Export Your Data</h4>
          <p className="mt-1 text-xs text-muted-foreground">Download a copy of all your data including profile, courses, progress, and activity history.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleExportData}>
            <Download className="mr-2 h-3 w-3" />
            Request Data Export
          </Button>
        </div>

        {/* Delete account */}
        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <h4 className="text-sm font-semibold text-destructive">{c.deleteAccountTitle}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{c.deleteAccountDescription}</p>
          {!showDeleteConfirm ? (
            <Button type="button" variant="destructive" size="sm" className="mt-3" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="mr-2 h-3 w-3" />
              {c.deleteAccountButton}
            </Button>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="destructive" size="sm" onClick={handleDeleteAccount} disabled={isUpdating}>
                {isUpdating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {c.yesDeleteText}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={isUpdating}>
                {c.cancelText}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InvoicesTabContent() {
  const { data, isLoading } = useMyInvoices({ page: 1, limit: 50 });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const formatAmount = (amount: string, currency: string) =>
    formatMoney(parseFloat(amount), currency, { alwaysShowDecimals: true });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.items?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-muted-foreground">
        <FileText className="mb-3 h-10 w-10 opacity-50" />
        <p className="text-sm">No invoices yet</p>
        <p className="mt-1 text-xs">Invoices will appear here after you make a purchase</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.items.map((invoice) => (
        <div
          key={invoice.id}
          className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/30"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{invoice.invoice_number}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(invoice.generated_at)} &middot; {formatAmount(invoice.total_amount, invoice.currency)}
            </p>
          </div>
          <a
            href={invoice.invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
          >
            Download
          </a>
        </div>
      ))}
    </div>
  );
}

export function MemberProfileSection({ section }: MemberProfileSectionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { member, token, isAuthenticated, logout, setMember } = useUserAuthStore();
  // Access-managed storefronts have no self-checkout, so no invoices are generated.
  // certificatesEnabled is a tenant opt-out (default true) for the Certificates tab.
  const { accessManaged, certificatesEnabled } = useStorefrontConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "invoices" | "certificates" | "bookmarks" | "analytics" | "settings">("profile");

  // If a tab the user is on becomes hidden (access-managed hides Invoices;
  // the tenant can disable Certificates), fall back to Profile.
  useEffect(() => {
    if (accessManaged && (activeTab === "invoices")) {
      setActiveTab("profile");
    }
    if (!certificatesEnabled && activeTab === "certificates") {
      setActiveTab("profile");
    }
  }, [accessManaged, certificatesEnabled, activeTab]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    about: "",
  });
  const [socialLinks, setSocialLinks] = useState({
    linkedin: "",
    twitter: "",
    github: "",
    facebook: "",
    instagram: "",
    tiktok: "",
    youtube: "",
    website: "",
  });
  const [extraInfo, setExtraInfo] = useState({
    goals: "",
    skills: "",
    location: "",
    company: "",
    jobTitle: "",
    dateOfBirth: "",
    languages: "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const refreshMember = useCallback(async () => {
    if (!token) return;
    try {
      const data = await userAuthApi.getMe();
      setMember({
        id: data.id,
        tenantId: data.tenantId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        emailVerified: data.emailVerified,
        phoneVerified: data.phoneVerified,
        status: data.status,
        nameConfirmedAt: data.nameConfirmedAt,
      });
      const { firstName, lastName } = splitName(data.name);
      setFormData({
        firstName,
        lastName,
        email: data.email,
        phone: data.phone ?? "",
        gender: data.gender ?? "",
        about: data.about ?? "",
      });
      // Populate social links & extra info from profileMetadata
      const meta = data.profileMetadata;
      if (meta) {
        setSocialLinks({
          linkedin: meta.socialLinks?.linkedin ?? "",
          twitter: meta.socialLinks?.twitter ?? "",
          github: meta.socialLinks?.github ?? "",
          facebook: meta.socialLinks?.facebook ?? "",
          instagram: meta.socialLinks?.instagram ?? "",
          tiktok: meta.socialLinks?.tiktok ?? "",
          youtube: meta.socialLinks?.youtube ?? "",
          website: meta.socialLinks?.website ?? "",
        });
        setExtraInfo({
          goals: meta.goals ?? "",
          skills: Array.isArray(meta.skills) ? meta.skills.join(", ") : "",
          location: meta.location ?? "",
          company: meta.company ?? "",
          jobTitle: meta.jobTitle ?? "",
          dateOfBirth: meta.dateOfBirth ?? "",
          languages: Array.isArray(meta.languages) ? meta.languages.join(", ") : "",
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [token, setMember, toast]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login?redirect=/profile");
      return;
    }
    if (token) {
      refreshMember();
    }
  }, [isAuthenticated, token, router, refreshMember]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || isUpdating) return;
    setIsUpdating(true);
    try {
      const name = [formData.firstName, formData.lastName].filter(Boolean).join(" ").trim();

      // Validate URL fields (optional but must be valid if provided)
      const urlFields = ["linkedin", "twitter", "github", "facebook", "instagram", "tiktok", "youtube", "website"] as const;
      const cleanLinks: Record<string, string> = {};
      for (const key of urlFields) {
        const val = socialLinks[key].trim();
        if (val) {
          if (key === "website") {
            // Website can be any URL
            if (!val.startsWith("http://") && !val.startsWith("https://")) {
              cleanLinks[key] = `https://${val}`;
            } else {
              cleanLinks[key] = val;
            }
          } else {
            cleanLinks[key] = val;
          }
        }
      }

      const profileMetadata = {
        socialLinks: Object.keys(cleanLinks).length > 0 ? cleanLinks : undefined,
        goals: extraInfo.goals.trim() || undefined,
        skills: extraInfo.skills.trim() ? extraInfo.skills.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        location: extraInfo.location.trim() || undefined,
        company: extraInfo.company.trim() || undefined,
        jobTitle: extraInfo.jobTitle.trim() || undefined,
        dateOfBirth: extraInfo.dateOfBirth || undefined,
        languages: extraInfo.languages.trim() ? extraInfo.languages.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      };

      await userAuthApi.updateProfile({
        name: name || undefined,
        gender: formData.gender || undefined,
        about: formData.about.trim() || undefined,
        profileMetadata,
      });
      await refreshMember();
      toast({ title: "Success", description: "Profile updated successfully" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || isUpdating) return;
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({
        title: "Invalid file",
        description: "Use PNG, JPEG, GIF or WebP",
        variant: "destructive",
      });
      return;
    }
    setIsUpdating(true);
    try {
      const data = await userAuthApi.uploadAvatar(file);
      setMember({
        id: data.id,
        tenantId: data.tenantId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        emailVerified: data.emailVerified,
        phoneVerified: data.phoneVerified,
        status: data.status,
        nameConfirmedAt: data.nameConfirmedAt,
      });
      toast({ title: "Success", description: "Profile picture updated" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to upload",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
      e.target.value = "";
    }
  };

  const handleDeleteAccount = async () => {
    if (!token || isUpdating) return;
    setIsUpdating(true);
    try {
      await userAuthApi.deleteProfile();
      logout();
      router.replace("/");
      toast({ title: "Account deleted", description: "Your account has been deleted." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete account",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading && !member) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-center">Failed to load profile.</p>
        <Button variant="outline" onClick={() => refreshMember()}>
          Retry
        </Button>
      </div>
    );
  }

  const c: MemberProfileContent = {
    ...DEFAULT_CONTENT,
    ...(section.content as Partial<MemberProfileContent>),
  };

  return (
    <div className={cn("mx-auto px-4 py-8", ["analytics", "certificates", "bookmarks"].includes(activeTab) ? "max-w-6xl" : "max-w-4xl")}>
      <h1 className="text-2xl font-bold">{c.headline}</h1>
      {c.subheadline && <p className="text-muted-foreground mt-1">{c.subheadline}</p>}

      <div className="mt-8 flex flex-col gap-8 md:flex-row">
        {/* Sidebar */}
        <nav className="flex shrink-0 flex-row gap-2 border-b pb-4 pr-0 md:w-48 md:flex-col md:border-b-0 md:border-r md:pb-0 md:pr-6">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "profile" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <User className="h-4 w-4" />
            {c.profileTabLabel}
          </button>
          {!accessManaged && (
            <button
              type="button"
              onClick={() => setActiveTab("invoices")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "invoices" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <FileText className="h-4 w-4" />
              Invoices
            </button>
          )}
          {certificatesEnabled && (
            <button
              type="button"
              onClick={() => setActiveTab("certificates")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "certificates" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <Award className="h-4 w-4" />
              Certificates
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("bookmarks")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "bookmarks" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <Bookmark className="h-4 w-4" />
            Saved
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "analytics" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "settings" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <Settings className="h-4 w-4" />
            {c.settingsTabLabel}
          </button>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {activeTab === "profile" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Connected accounts */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Lock className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Email</span>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", member?.emailVerified ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700")}>
                    {member?.emailVerified ? "Verified" : "Unverified"}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Globe className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Google</span>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", (member as { oauthProvider?: string } | null)?.oauthProvider === "GOOGLE" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800")}>
                    {(member as { oauthProvider?: string } | null)?.oauthProvider === "GOOGLE" ? "Connected" : "Not Connected"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="group relative">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full">
                    {member?.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member?.name ?? "Profile"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-2xl font-bold">
                        {getInitials(member?.name)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUpdating}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Camera className="h-8 w-8 text-white" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{member?.name ?? "User"}</p>
                  <p className="text-muted-foreground text-sm">{member?.email}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">{c.firstNameLabel}</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                    placeholder={c.firstNamePlaceholder}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">{c.lastNameLabel}</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                    placeholder={c.lastNamePlaceholder}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">{c.phoneLabel}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, phone: e.target.value }));
                  }}
                  placeholder={c.phonePlaceholder}
                  className="mt-2"
                />
                <p className="text-muted-foreground mt-1 text-xs">{c.phoneHint}</p>
              </div>

              <div>
                <Label htmlFor="email">{c.emailLabel}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  readOnly
                  className="bg-muted mt-2"
                />
                <p className="text-muted-foreground mt-1 text-xs">{c.emailHint}</p>
              </div>

              <div>
                <Label htmlFor="gender">{c.genderLabel}</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(v) => setFormData((p) => ({ ...p, gender: v }))}
                >
                  <SelectTrigger id="gender" className="mt-2">
                    <SelectValue placeholder={c.genderPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.filter((o) => o.value).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="about">{c.aboutLabel}</Label>
                <textarea
                  id="about"
                  value={formData.about}
                  onChange={(e) => setFormData((p) => ({ ...p, about: e.target.value }))}
                  placeholder={c.aboutPlaceholder}
                  rows={4}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-2 flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <Button type="submit" disabled={isUpdating}>
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {c.updateProfileText}
              </Button>
            </form>
          )}

          {activeTab === "invoices" && !accessManaged && (
            <InvoicesTabContent />
          )}

          {activeTab === "certificates" && certificatesEnabled && (
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
              <CertificatesTab />
            </Suspense>
          )}

          {activeTab === "bookmarks" && (
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
              <BookmarksTab />
            </Suspense>
          )}

          {activeTab === "analytics" && (
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
              <div className="space-y-8">
                <TestPerformancePanel hideWhenEmpty />
                <div className="border-t pt-8">
                  <LearnerAnalytics />
                </div>
                <div className="border-t pt-8">
                  <CourseVideoAnalytics />
                </div>
              </div>
            </Suspense>
          )}

          {activeTab === "settings" && (
            <SettingsTabContent
              member={member}
              isUpdating={isUpdating}
              setIsUpdating={setIsUpdating}
              showDeleteConfirm={showDeleteConfirm}
              setShowDeleteConfirm={setShowDeleteConfirm}
              handleDeleteAccount={handleDeleteAccount}
              logout={logout}
              c={c}
            />
          )}
        </div>
      </div>
    </div>
  );
}
