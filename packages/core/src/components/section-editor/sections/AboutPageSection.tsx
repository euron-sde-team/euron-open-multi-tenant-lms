"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  AboutPageContent,
  AboutPageValue,
  AboutPageTeamMember,
} from "@open-mtlms/shared";
import {
  Heart, Users, Zap, Shield, Star, Target, Globe, Award,
  Plus, Trash2,
} from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, React.ElementType> = {
  heart: Heart, users: Users, zap: Zap, shield: Shield,
  star: Star, target: Target, globe: Globe, award: Award,
};

const iconOptions = Object.keys(iconMap);

interface AboutPageSectionProps { section: SectionConfig; }

export function AboutPageSection({ section }: AboutPageSectionProps) {
  const { isEditMode, EditableText, EditableImage, EditableMedia, updateSectionContent } = useSectionEditor();
  const content = section.content as AboutPageContent;
  const variant = section.variant;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof AboutPageContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const values = content?.values ?? [];
  const stats = content?.stats ?? [];
  const team = content?.teamMembers ?? [];
  const isMinimal = variant === "minimal";
  const isSplit = variant === "split";

  // Values CRUD
  const handleValueUpdate = (index: number, updates: Partial<AboutPageValue>) => {
    const newValues = [...values];
    newValues[index] = { ...newValues[index], ...updates };
    handleContentUpdate("values", newValues);
  };

  const addValue = () => {
    const newValue: AboutPageValue = {
      id: `value-${Date.now()}`,
      icon: "heart",
      title: "New Value",
      description: "Describe this value...",
    };
    handleContentUpdate("values", [...values, newValue]);
  };

  const removeValue = (index: number) => {
    if (values.length <= 1) return;
    handleContentUpdate("values", values.filter((_, i) => i !== index));
  };

  // Stats CRUD
  const handleStatUpdate = (index: number, updates: Partial<(typeof stats)[0]>) => {
    const newStats = [...stats];
    newStats[index] = { ...newStats[index], ...updates };
    handleContentUpdate("stats", newStats);
  };

  const addStat = () => {
    handleContentUpdate("stats", [
      ...stats,
      { id: `stat-${Date.now()}`, value: "0", label: "New stat", suffix: "+" },
    ]);
  };

  const removeStat = (index: number) => {
    if (stats.length <= 1) return;
    handleContentUpdate("stats", stats.filter((_, i) => i !== index));
  };

  // Team CRUD
  const handleTeamUpdate = (index: number, updates: Partial<AboutPageTeamMember>) => {
    const newTeam = [...team];
    newTeam[index] = { ...newTeam[index], ...updates };
    handleContentUpdate("teamMembers", newTeam);
  };

  const addTeamMember = () => {
    const newMember: AboutPageTeamMember = {
      id: `member-${Date.now()}`,
      name: "New Member",
      role: "Role",
    };
    handleContentUpdate("teamMembers", [...team, newMember]);
  };

  const removeTeamMember = (index: number) => {
    if (team.length <= 1) return;
    handleContentUpdate("teamMembers", team.filter((_, i) => i !== index));
  };

  return (
    <section className={cn("py-16 md:py-24", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom space-y-20">
        {/* Hero / Header */}
        <div className="mx-auto max-w-3xl text-center">
          <EditableText value={content?.headline ?? "About Us"} onChange={(v) => handleContentUpdate("headline", v)} as="h1" className="text-4xl font-bold tracking-tight sm:text-5xl" />
          {(content?.subheadline || isEditMode) && (
            <p className="mt-4 text-lg text-muted-foreground">
              <EditableText value={content?.subheadline ?? ""} onChange={(v) => handleContentUpdate("subheadline", v)} />
            </p>
          )}
        </div>

        {/* Story + Image */}
        <div className={cn(
          "mx-auto max-w-5xl",
          (isSplit || !isMinimal) && (content?.storyImage || isEditMode) ? "grid items-center gap-12 lg:grid-cols-2" : "max-w-3xl"
        )}>
          {(isSplit || !isMinimal) && (content?.storyImage || isEditMode) && (
            <div className={cn("relative overflow-hidden rounded-2xl", isSplit ? "order-first" : "order-first lg:order-none")}>
              <EditableMedia
                image={content?.storyImage}
                imageAlt={content?.storyImageAlt ?? "About us"}
                onImageChange={(src, alt) => {
                  handleContentUpdate("storyImage", src);
                  handleContentUpdate("storyImageAlt", alt);
                }}
                onVideoChange={() => {}}
                className="rounded-2xl"
                aspectRatio="video"
                placeholder="Add story image"
                recommendedAspectRatio="16:9"
                sectionContext={{
                  sectionType: section.type,
                  headline: content?.headline,
                  description: content?.subheadline,
                }}
              />
            </div>
          )}
          <div className="space-y-6">
            <p className="text-lg leading-relaxed text-muted-foreground">
              <EditableText value={content?.story ?? ""} onChange={(v) => handleContentUpdate("story", v)} multiline />
            </p>
            {(content?.mission || isEditMode) && (
              <div className="rounded-lg border-l-4 border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">Our Mission</p>
                <p className="mt-1 text-muted-foreground">
                  <EditableText value={content?.mission ?? ""} onChange={(v) => handleContentUpdate("mission", v)} />
                </p>
              </div>
            )}
            {(content?.vision || isEditMode) && (
              <div className="rounded-lg border-l-4 border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">Our Vision</p>
                <p className="mt-1 text-muted-foreground">
                  <EditableText value={content?.vision ?? ""} onChange={(v) => handleContentUpdate("vision", v)} />
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Values */}
        {(values.length > 0 || isEditMode) && (
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center text-2xl font-bold">
              <EditableText value="Our Values" onChange={() => {}} as="span" />
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((v, i) => {
                const Icon = iconMap[v.icon] ?? Heart;
                return (
                  <div key={v.id} className="group/value relative rounded-xl border bg-card p-6 text-center">
                    {isEditMode && values.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeValue(i)}
                        className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/value:opacity-100"
                        title="Remove value"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      {isEditMode ? (
                        <select
                          value={v.icon}
                          onChange={(e) => handleValueUpdate(i, { icon: e.target.value })}
                          className="h-full w-full cursor-pointer appearance-none bg-transparent text-center text-xs"
                          title="Choose icon"
                        >
                          {iconOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <Icon className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <h3 className="font-semibold">
                      <EditableText value={v.title} onChange={(val) => handleValueUpdate(i, { title: val })} />
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <EditableText value={v.description} onChange={(val) => handleValueUpdate(i, { description: val })} />
                    </p>
                  </div>
                );
              })}
            </div>
            {isEditMode && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" onClick={addValue}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Value
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        {(stats.length > 0 || isEditMode) && (
          <div className="mx-auto max-w-5xl rounded-2xl bg-muted/50 p-8">
            <div className={cn("grid gap-8 text-center", stats.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
              {stats.map((s, i) => (
                <div key={s.id} className="group/stat relative">
                  {isEditMode && stats.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStat(i)}
                      className="absolute -right-1 -top-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/stat:opacity-100"
                      title="Remove stat"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  <p className="text-3xl font-bold text-primary">
                    <EditableText value={s.value} onChange={(v) => handleStatUpdate(i, { value: v })} as="span" placeholder="0" />
                    {(s.suffix || isEditMode) && (
                      <EditableText value={s.suffix ?? ""} onChange={(v) => handleStatUpdate(i, { suffix: v })} as="span" className="text-2xl" placeholder="+" />
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <EditableText value={s.label} onChange={(v) => handleStatUpdate(i, { label: v })} as="span" />
                  </p>
                </div>
              ))}
            </div>
            {isEditMode && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" onClick={addStat}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stat
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Team */}
        {!isMinimal && (team.length > 0 || isEditMode) && (
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center text-2xl font-bold">
              <EditableText value={content?.teamHeadline ?? "Meet Our Team"} onChange={(v) => handleContentUpdate("teamHeadline", v)} />
            </h2>
            <div className={cn("grid justify-items-center gap-8", team.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
              {team.map((m, i) => (
                <div key={m.id} className="group/member relative text-center">
                  {isEditMode && team.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTeamMember(i)}
                      className="absolute -right-1 -top-1 z-10 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/member:opacity-100"
                      title="Remove member"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  <EditableImage
                    src={m.avatar ?? ""}
                    alt={m.name}
                    onChange={(src) => handleTeamUpdate(i, { avatar: src || undefined })}
                    className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full"
                    aspectRatio="square"
                    placeholder="Avatar URL..."
                  />
                  {!m.avatar && (
                    <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground">{m.name.charAt(0)}</div>
                  )}
                  <h3 className="font-semibold">
                    <EditableText value={m.name} onChange={(v) => handleTeamUpdate(i, { name: v })} />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <EditableText value={m.role} onChange={(v) => handleTeamUpdate(i, { role: v })} />
                  </p>
                </div>
              ))}
            </div>
            {isEditMode && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" onClick={addTeamMember}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Team Member
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
