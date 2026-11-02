"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  FoundersContent,
  SectionConfig,
  TeamContent,
  TeamMember,
  TextStyle,
} from "@open-mtlms/shared";
import { Globe, Linkedin, Plus, Trash2, Twitter, Youtube } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";
import type { SectionEditorContextValue as SectionEditorValue } from "../SectionEditorContext";

/**
 * The people behind the academy: founders, and the wider team.
 *
 * ONE component for both sections. A founder card and a team card hold the same
 * fields and differ in how much they show, founders get a portrait, a role and
 * their story; the team gets a denser grid, so splitting them would mean
 * maintaining the editing, the social links and the photo handling twice.
 *
 * Everything decorative is built from THEME TOKENS (primary, card, border,
 * muted), never fixed colours, so it takes on each academy's palette and works
 * in dark mode. The glows and the dot grid are skipped when an admin has set
 * their own section background, so we never fight a colour they chose.
 */

const SOCIALS: Array<{ key: string; label: string }> = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitter", label: "X" },
  { key: "youtube", label: "YouTube" },
  { key: "website", label: "Website" },
];

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  linkedin: Linkedin,
  twitter: Twitter,
  youtube: Youtube,
  website: Globe,
};

/** Initials, shown until a person has a photo. */
function initials(name: string | undefined): string {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function linkFor(member: TeamMember, platform: string): string {
  return member.socialLinks?.find((l) => l.platform === platform)?.url ?? "";
}

function withLink(member: TeamMember, platform: string, url: string): TeamMember {
  const rest = (member.socialLinks ?? []).filter((l) => l.platform !== platform);
  const next = url.trim() ? [...rest, { platform, url: url.trim() }] : rest;
  return { ...member, socialLinks: next };
}

function SocialRow({
  member,
  size = "default",
}: {
  member: TeamMember;
  size?: "default" | "sm";
}) {
  const links = SOCIALS.filter(({ key }) => linkFor(member, key));
  if (links.length === 0) return null;
  return (
    <div className={cn("flex items-center gap-2", size === "sm" ? "justify-center" : "")}>
      {links.map(({ key, label }) => {
        const Icon = SOCIAL_ICONS[key];
        return (
          <a
            key={key}
            href={linkFor(member, key)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name} on ${label}`}
            className={cn(
              "text-muted-foreground grid place-items-center rounded-full border transition-all duration-200",
              "hover:border-primary/40 hover:text-primary hover:bg-primary/5 hover:-translate-y-0.5",
              size === "sm" ? "h-8 w-8" : "h-9 w-9"
            )}
          >
            <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </a>
        );
      })}
    </div>
  );
}

function SocialInputs({
  member,
  onChange,
}: {
  member: TeamMember;
  onChange: (next: TeamMember) => void;
}) {
  return (
    <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
      {SOCIALS.map(({ key, label }) => (
        <input
          key={key}
          value={linkFor(member, key)}
          onChange={(e) => onChange(withLink(member, key, e.target.value))}
          placeholder={label}
          className="bg-muted/40 focus:ring-primary/30 placeholder:text-muted-foreground/60 w-full rounded-md px-2 py-1 text-[11px] outline-none focus:ring-2"
        />
      ))}
    </div>
  );
}

/**
 * The portrait, with its ring and glow.
 *
 * Defined at MODULE level, not inside PeopleSection. Declaring a component
 * inside another makes it a new component type on every render, so React
 * unmounts and remounts this whole subtree each time the section re-renders.
 * taking the open image picker dialog with it, which is why a photo chosen for
 * a founder never made it back onto the card.
 */
function Portrait({
  member,
  size,
  isEditMode,
  EditableImage,
  onPick,
}: {
  member: TeamMember;
  size: "lg" | "md";
  isEditMode: boolean;
  EditableImage: SectionEditorValue["EditableImage"];
  onPick: (src: string) => void;
}) {
  const name = member.name ?? "";
  return (
    <div className={cn("group/photo relative shrink-0", size === "lg" ? "h-32 w-32" : "h-24 w-24")}>
      {/* Glow, lit on hover of the whole card */}
      <div
        aria-hidden
        className="bg-primary/20 absolute -inset-2 rounded-full opacity-0 blur-xl transition-opacity duration-500 group-hover/card:opacity-100"
      />
      {/* Gradient ring */}
      <div className="from-primary/50 via-primary/20 to-primary/5 relative h-full w-full rounded-full bg-gradient-to-br p-[2px]">
        <div className="bg-card h-full w-full overflow-hidden rounded-full">
          {member.avatar || isEditMode ? (
            <EditableImage
              src={member.avatar || ""}
              alt={name}
              onChange={onPick}
              className="h-full w-full object-cover"
              aspectRatio="square"
              placeholder="PHOTO"
              compact
            />
          ) : (
            <span
              className={cn(
                "from-primary/15 to-primary/5 text-primary grid h-full w-full place-items-center bg-gradient-to-br font-bold",
                size === "lg" ? "text-3xl" : "text-2xl"
              )}
            >
              {initials(name)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PeopleSection({
  section,
  variantStyle,
}: {
  section: SectionConfig;
  /** Founders get the editorial two column card; the team gets the grid. */
  variantStyle: "founders" | "team";
}) {
  const { isEditMode, EditableText, EditableImage, updateSectionContent } = useSectionEditor();
  const content = section.content as (FoundersContent | TeamContent) & {
    members?: TeamMember[];
  };
  const hasCustomBg = hasCustomSectionBackground(section);

  // AI generated content, or an older saved section, can arrive without some
  // of these. A missing name used to throw inside initials() and take the whole
  // section down with it.
  const members = Array.isArray(content.members) ? content.members : [];
  const isFounders = variantStyle === "founders";
  // "detailed" is the team variant that shows bios, so it reads like founders.
  const showBio = isFounders || section.variant === "detailed";

  const setContent = (key: string, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });

  const setTextStyle = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const setMember = (index: number, updates: Partial<TeamMember>) => {
    const next = [...members];
    next[index] = { ...next[index], ...updates };
    setContent("members", next);
  };

  const addMember = () => {
    setContent("members", [
      ...members,
      {
        id: `person-${Date.now()}`,
        name: isFounders ? "Co founder name" : "Team member name",
        role: isFounders ? "Co founder" : "Role",
        bio: showBio ? "A sentence about what they do here." : undefined,
      } satisfies TeamMember,
    ]);
  };

  const removeMember = (index: number) => {
    // The last person stays: an empty people section is a bare heading, which
    // reads as a broken page rather than a deliberate one.
    if (members.length <= 1) return;
    setContent(
      "members",
      members.filter((_, i) => i !== index)
    );
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden py-20 md:py-28",
        hasCustomBg ? "bg-transparent" : "bg-background"
      )}
    >
      {/* Decoration. Skipped when the admin picked their own background. */}
      {!hasCustomBg && (
        <>
          <div
            aria-hidden
            className="bg-primary/[0.07] pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full blur-3xl"
          />
          <div
            aria-hidden
            className="bg-primary/[0.05] pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(hsl(var(--muted-foreground) / 0.25) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(70% 55% at 50% 40%, black, transparent 80%)",
              WebkitMaskImage: "radial-gradient(70% 55% at 50% 40%, black, transparent 80%)",
            }}
          />
        </>
      )}

      <div className="container-custom relative z-10">
        {/* Heading */}
        <div className="mx-auto mb-14 max-w-2xl text-center">
          {(content.label || isEditMode) && (
            <div className="mb-4 flex justify-center">
              <span className="bg-card/70 text-primary inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur">
                <span className="bg-primary h-1.5 w-1.5 rounded-full" aria-hidden />
                <EditableText
                  value={content.label ?? ""}
                  onChange={(v) => setContent("label", v)}
                  styleKey="label"
                  style={content.textStyles?.label}
                  onStyleChange={(s) => setTextStyle("label", s)}
                />
              </span>
            </div>
          )}

          <EditableText
            value={content.headline}
            onChange={(v) => setContent("headline", v)}
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => setTextStyle("headline", s)}
            as="h2"
            className="text-[clamp(1.75rem,4.5vw,2.75rem)] font-bold leading-[1.1] tracking-tight"
          />

          {/* Short rule under the heading, tying it to the brand colour */}
          <div
            aria-hidden
            className="via-primary/60 mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent to-transparent"
          />

          {(content.subheadline || isEditMode) && (
            <p className="text-muted-foreground mt-5 text-[15px] leading-relaxed">
              <EditableText
                value={content.subheadline ?? ""}
                onChange={(v) => setContent("subheadline", v)}
                styleKey="subheadline"
                style={content.textStyles?.subheadline}
                onStyleChange={(s) => setTextStyle("subheadline", s)}
                multiline
              />
            </p>
          )}
        </div>

        {/* People */}
        <div
          className={cn(
            "grid gap-6",
            isFounders
              ? "mx-auto max-w-5xl md:grid-cols-2"
              : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {members.map((member, i) => (
            <div
              key={member.id}
              className={cn(
                "group/card relative overflow-hidden rounded-3xl border transition-all duration-300",
                "from-card to-muted/20 bg-gradient-to-b",
                "hover:border-primary/30 hover:shadow-primary/10 hover:-translate-y-1.5 hover:shadow-xl",
                isFounders ? "p-7 sm:p-8" : "p-6 text-center"
              )}
            >
              {/* Hairline of brand colour along the top edge, on hover */}
              <div
                aria-hidden
                className="via-primary/60 absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
              />

              {/* Oversized initial, sitting far back */}
              {isFounders && (
                <span
                  aria-hidden
                  className="text-foreground/[0.035] pointer-events-none absolute -right-2 -top-6 select-none text-[7rem] font-black leading-none"
                >
                  {initials(member.name).slice(0, 1) || "•"}
                </span>
              )}

              {isEditMode && members.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMember(i)}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive absolute right-3 top-3 z-20 rounded-md p-1.5 opacity-0 transition-opacity group-hover/card:opacity-100"
                  title="Remove person"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              <div
                className={cn(
                  "relative",
                  isFounders
                    ? "flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left"
                    : "flex flex-col items-center"
                )}
              >
                <Portrait
                  member={member}
                  size={isFounders ? "lg" : "md"}
                  isEditMode={isEditMode}
                  EditableImage={EditableImage}
                  onPick={(src) => setMember(i, { avatar: src })}
                />

                <div className={cn("min-w-0 flex-1", isFounders ? "" : "mt-4 w-full")}>
                  <h3 className={cn("font-bold tracking-tight", isFounders ? "text-xl" : "text-[15px]")}>
                    <EditableText
                      value={member.name ?? ""}
                      onChange={(v) => setMember(i, { name: v })}
                      styleKey={`person-${i}-name`}
                      style={content.textStyles?.[`person-${i}-name`]}
                      onStyleChange={(s) => setTextStyle(`person-${i}-name`, s)}
                    />
                  </h3>

                  {(member.role || isEditMode) && (
                    <div className={cn("mt-2", isFounders ? "" : "flex justify-center")}>
                      <span className="bg-primary/10 text-primary inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                        <EditableText
                          value={member.role ?? ""}
                          onChange={(v) => setMember(i, { role: v })}
                          styleKey={`person-${i}-role`}
                          style={content.textStyles?.[`person-${i}-role`]}
                          onStyleChange={(s) => setTextStyle(`person-${i}-role`, s)}
                        />
                      </span>
                    </div>
                  )}

                  {showBio && (member.bio || isEditMode) && (
                    <p className="text-muted-foreground mt-3.5 text-[13.5px] leading-relaxed">
                      <EditableText
                        value={member.bio ?? ""}
                        onChange={(v) => setMember(i, { bio: v })}
                        styleKey={`person-${i}-bio`}
                        style={content.textStyles?.[`person-${i}-bio`]}
                        onStyleChange={(s) => setTextStyle(`person-${i}-bio`, s)}
                        multiline
                      />
                    </p>
                  )}

                  {isEditMode ? (
                    <SocialInputs member={member} onChange={(next) => setMember(i, next)} />
                  ) : (
                    <div className={cn("mt-4", isFounders ? "" : "flex justify-center")}>
                      <SocialRow member={member} size={isFounders ? "default" : "sm"} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {isEditMode && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="sm" onClick={addMember}>
              <Plus className="mr-2 h-4 w-4" />
              {isFounders ? "Add founder" : "Add team member"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function FoundersSection({ section }: { section: SectionConfig }) {
  return <PeopleSection section={section} variantStyle="founders" />;
}

export function TeamSection({ section }: { section: SectionConfig }) {
  return <PeopleSection section={section} variantStyle="team" />;
}
