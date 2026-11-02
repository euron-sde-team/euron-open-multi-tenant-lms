"use client";

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@open-mtlms/core";
import type { MemberProfileContent, SectionConfig } from "@open-mtlms/shared/types";
import { User, Settings, Trash2 } from "lucide-react";
import { useState } from "react";

import { EditableText } from "@/components/editor/editable-text";
import { useEditMode, useContentEditable } from "@/lib/contexts/edit-mode-context";
import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

interface MemberProfileSectionProps {
  section: SectionConfig;
}

function getInitials(name: string): string {
  if (!name?.trim()) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const GENDER_OPTIONS = [
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

const MOCK_MEMBER = { name: "John Doe", email: "john@example.com", avatarUrl: null as string | null };
const MOCK_FORM_DATA = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+1 234567890",
  gender: "male",
  about: "Sample bio text for preview. This is how the profile form will appear on the live site.",
};

/**
 * Admin preview of the member-profile section.
 * Renders the same layout as the live profile page with mock data.
 * All static text is inline-editable (click to edit) like course-hero, about-page.
 */
export function MemberProfileSection({ section }: MemberProfileSectionProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "settings">("profile");
  const isEditMode = useEditMode();
  const isContentEditable = useContentEditable();
  const { updateSectionContent } = useEditorStore();

  const c = { ...DEFAULT_CONTENT, ...(section.content as Partial<MemberProfileContent>) };

  const handleContentUpdate = (key: keyof MemberProfileContent, value: string) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const editable = (key: keyof MemberProfileContent) =>
    isContentEditable ? (
      <EditableText
        value={c[key] ?? ""}
        onChange={(v) => handleContentUpdate(key, v)}
        as="span"
        placeholder={String(DEFAULT_CONTENT[key] ?? "")}
      />
    ) : (
      (c[key] as string) ?? ""
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {isContentEditable ? (
        <EditableText
          value={c.headline ?? ""}
          onChange={(v) => handleContentUpdate("headline", v)}
          as="h1"
          className="text-2xl font-bold"
          placeholder="Profile"
        />
      ) : (
        <h1 className="text-2xl font-bold">{c.headline}</h1>
      )}
      {(c.subheadline || isContentEditable) &&
        (isContentEditable ? (
          <EditableText
            value={c.subheadline ?? ""}
            onChange={(v) => handleContentUpdate("subheadline", v)}
            as="p"
            className="text-muted-foreground mt-1"
            placeholder="Manage your account settings"
          />
        ) : (
          <p className="text-muted-foreground mt-1">{c.subheadline}</p>
        ))}

      <div className="mt-8 flex flex-col gap-8 md:flex-row">
        {/* Sidebar - Profile / Settings tabs */}
        <nav className="flex shrink-0 flex-row gap-2 border-b md:w-48 md:flex-col md:border-b-0 md:border-r pr-0 pb-4 md:pb-0 md:pr-6">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "profile" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <User className="h-4 w-4" />
            {editable("profileTabLabel")}
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
            {editable("settingsTabLabel")}
          </button>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {activeTab === "profile" && (
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              {/* Avatar + name */}
              <div className="flex items-center gap-6">
                <div className="relative h-24 w-24 overflow-hidden rounded-full">
                  {MOCK_MEMBER.avatarUrl ? (
                    <img
                      src={MOCK_MEMBER.avatarUrl}
                      alt={MOCK_MEMBER.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-2xl font-bold">
                      {getInitials(MOCK_MEMBER.name)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{MOCK_MEMBER.name}</p>
                  <p className="text-muted-foreground text-sm">{MOCK_MEMBER.email}</p>
                </div>
              </div>

              {/* Form fields - all disabled for preview */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">{editable("firstNameLabel")}</Label>
                  <Input
                    id="firstName"
                    value={MOCK_FORM_DATA.firstName}
                    disabled
                    className="mt-2 bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">{editable("lastNameLabel")}</Label>
                  <Input
                    id="lastName"
                    value={MOCK_FORM_DATA.lastName}
                    disabled
                    className="mt-2 bg-muted"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">{editable("phoneLabel")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={MOCK_FORM_DATA.phone}
                  disabled
                  className="mt-2 bg-muted"
                />
                <p className="text-muted-foreground mt-1 text-xs">{editable("phoneHint")}</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" disabled>
                  {editable("sendVerificationCodeText")}
                </Button>
              </div>

              <div>
                <Label htmlFor="email">{editable("emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={MOCK_FORM_DATA.email}
                  disabled
                  className="mt-2 bg-muted"
                />
                <p className="text-muted-foreground mt-1 text-xs">{editable("emailHint")}</p>
              </div>

              <div>
                <Label htmlFor="gender">{editable("genderLabel")}</Label>
                <Select value={MOCK_FORM_DATA.gender} disabled>
                  <SelectTrigger id="gender" className="mt-2">
                    <SelectValue placeholder={c.genderPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="about">{editable("aboutLabel")}</Label>
                <textarea
                  id="about"
                  value={MOCK_FORM_DATA.about}
                  disabled
                  rows={4}
                  className="border-input bg-muted ring-offset-background mt-2 flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <Button type="submit" disabled>
                {editable("updateProfileText")}
              </Button>
            </form>
          )}

          {activeTab === "settings" && (
            <div className="space-y-6">
              <div className="rounded-lg border p-6">
                <h2 className="text-lg font-semibold">{editable("deleteAccountTitle")}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{editable("deleteAccountDescription")}</p>
                <Button type="button" variant="destructive" className="mt-4" disabled>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {editable("deleteAccountButton")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isEditMode && (
        <p className="text-muted-foreground mt-4 text-center text-xs">
          Preview with mock data. Renders the user profile form on <span className="font-medium">/profile</span> on the live site.
        </p>
      )}
    </div>
  );
}
