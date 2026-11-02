"use client";

import { Button, Input, Label, useToast } from "@open-mtlms/core";
import { getErrorMessage } from "@open-mtlms/shared";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { generateSlug } from "@/lib/utils/slug";

interface SlugEditorProps {
  /** Path before the slug on the live site, e.g. "/courses/". */
  basePath: string;
  /** The slug saved now, without the base path. */
  value: string;
  /** The current title, for "Regenerate from title". */
  title: string;
  /** What is being edited, for messages: "course", "book", "test series". */
  noun: string;
  /**
   * Save the slug. Resolve with the slug the server stored: it adds a short
   * code at the end when another item of the same kind already uses it.
   */
  onSave: (slug: string) => Promise<string>;
  disabled?: boolean;
}

/** Keep what can live in a URL while the admin types; a trailing hyphen may still become a word. */
function cleanWhileTyping(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}

/**
 * Edit the URL slug of a course, book, test series and the like. Created
 * automatically from the title; here the admin can type their own or rebuild it
 * from the current title (say, after fixing a typo in it), then save.
 */
export function SlugEditor({
  basePath,
  value,
  title,
  noun,
  onSave,
  disabled = false,
}: SlugEditorProps) {
  const { toast } = useToast();
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  // Follow the saved slug when it changes underneath (a reload, a refetch after
  // saving), but never over a URL the admin is still typing: a refetch that
  // lands a moment after a save must not wipe the next edit.
  const syncedRef = useRef(value);
  useEffect(() => {
    setDraft((current) => (current === syncedRef.current ? value : current));
    syncedRef.current = value;
  }, [value]);

  const cleaned = generateSlug(draft);
  const unchanged = cleaned === value;
  const fromTitle = generateSlug(title);

  const handleSave = async () => {
    if (!cleaned || unchanged) return;
    setSaving(true);
    try {
      const saved = await onSave(cleaned);
      setDraft(saved);
      syncedRef.current = saved;
      // The server appends "-" and a short code only when the URL was taken.
      const madeUnique = saved !== cleaned && /^-[a-z0-9]{4}$/.test(saved.slice(cleaned.length)) && saved.startsWith(cleaned);
      toast({
        title: "URL updated",
        description:
          saved === cleaned
            ? `Now at ${basePath}${saved}`
            : madeUnique
              ? `Another ${noun} already uses that URL, so a short code was added: ${basePath}${saved}`
              : `Saved as ${basePath}${saved}`,
      });
    } catch (err) {
      toast({
        title: "Could not update the URL",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Page URL</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="border-input flex min-w-0 flex-1 items-center rounded-md border">
          <span className="text-muted-foreground bg-muted shrink-0 rounded-l-md px-2.5 py-2 text-sm">
            {basePath}
          </span>
          <Input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(cleanWhileTyping(e.target.value))}
            onBlur={() => setDraft(cleaned)}
            disabled={disabled || saving}
            className="min-w-0 flex-1 rounded-l-none border-0 focus-visible:ring-0"
            placeholder={fromTitle || "my-url"}
            spellCheck={false}
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDraft(fromTitle)}
            disabled={disabled || saving || !fromTitle || fromTitle === cleaned}
            title="Rebuild the URL from the current title"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Regenerate from title
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={disabled || saving || !cleaned || unchanged}
          >
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save URL
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Lowercase letters, numbers and hyphens only. If another {noun} already
        uses this URL, a short code is added at the end to keep it unique.
        Links shared with the old URL will stop working.
      </p>
    </div>
  );
}
