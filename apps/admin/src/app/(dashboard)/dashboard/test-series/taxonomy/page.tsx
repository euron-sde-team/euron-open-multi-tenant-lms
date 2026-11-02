"use client";

import { Button, Card, CardContent, Input, useToast } from "@open-mtlms/core";
import {
  ArrowLeft,
  ChevronRight,
  FolderTree,
  Loader2,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { TaxonomyKind, TaxonomyNode } from "@/lib/api/test-series";
import {
  useCreateTaxonomy,
  useDeleteTaxonomy,
  useImportTaxonomyFromTags,
  useTaxonomy,
} from "@/lib/hooks/use-test-series";

interface ColumnProps {
  title: string;
  kind: TaxonomyKind;
  parentId?: string;
  parentLabel?: string;
  disabled?: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  selectable?: boolean;
}

function TaxonomyColumn({
  title,
  kind,
  parentId,
  parentLabel,
  disabled,
  selectedId,
  onSelect,
  selectable = true,
}: ColumnProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const { data: nodes = [], isLoading } = useTaxonomy(
    disabled ? undefined : kind,
    disabled ? undefined : parentId
  );
  const createMut = useCreateTaxonomy();
  const deleteMut = useDeleteTaxonomy();

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMut.mutate(
      { kind, name: trimmed, parentId: parentId ?? null },
      {
        onSuccess: () => setName(""),
        onError: (e: unknown) =>
          toast({
            title: "Could not add",
            description: e instanceof Error ? e.message : "Please try again",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div>
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          {parentLabel && (
            <p className="text-muted-foreground truncate text-xs">
              in {parentLabel}
            </p>
          )}
        </div>

        {disabled ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            Select a {kind === "CHAPTER" ? "subject" : "chapter"} first.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                value={name}
                placeholder={`Add ${kind.toLowerCase()}`}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add();
                }}
              />
              <Button
                size="sm"
                onClick={add}
                disabled={!name.trim() || createMut.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {isLoading ? (
                <p className="text-muted-foreground text-xs">Loading…</p>
              ) : nodes.length === 0 ? (
                <p className="text-muted-foreground text-xs">None yet.</p>
              ) : (
                nodes.map((n: TaxonomyNode) => (
                  <div
                    key={n.id}
                    className={`group flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm ${
                      selectedId === n.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-1 truncate text-left"
                      onClick={() => selectable && onSelect(n.id)}
                    >
                      <span className="truncate">{n.name}</span>
                      {selectable && (
                        <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => deleteMut.mutate(n.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function TaxonomyPage() {
  const { toast } = useToast();
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");

  const { data: subjects = [] } = useTaxonomy("SUBJECT");
  const { data: chapters = [] } = useTaxonomy(
    "CHAPTER",
    subjectId || undefined
  );
  const subjectName = subjects.find((s) => s.id === subjectId)?.name;
  const chapterName = chapters.find((c) => c.id === chapterId)?.name;

  const importMut = useImportTaxonomyFromTags();
  const runImport = () => {
    importMut.mutate(undefined, {
      onSuccess: (res) => {
        toast({
          title: "Imported from question tags",
          description: `Created ${res?.subjects ?? 0} subjects, ${res?.chapters ?? 0} chapters, ${res?.topics ?? 0} topics. Tagged ${res?.questionsTagged ?? 0} questions.`,
        });
      },
      onError: (e: unknown) =>
        toast({
          title: "Import failed",
          description: e instanceof Error ? e.message : "Please try again",
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/test-series"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center text-sm"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Test Series
          </Link>
          <div className="flex items-center gap-2">
            <FolderTree className="text-primary h-6 w-6" />
            <h1 className="text-3xl font-bold tracking-tight">Question Taxonomy</h1>
          </div>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Define your subjects, chapters and topics. Questions are tagged with
            these, and per-section test blueprints pick questions by them.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={runImport}
          disabled={importMut.isPending}
          title="Build the taxonomy from your questions' existing subject/chapter/topic and tag them all"
        >
          {importMut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Import from existing tags
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-[28rem]">
          <TaxonomyColumn
            title="Subjects"
            kind="SUBJECT"
            selectedId={subjectId}
            onSelect={(id) => {
              setSubjectId(id);
              setChapterId("");
            }}
          />
        </div>
        <div className="h-[28rem]">
          <TaxonomyColumn
            title="Chapters"
            kind="CHAPTER"
            parentId={subjectId || undefined}
            parentLabel={subjectName}
            disabled={!subjectId}
            selectedId={chapterId}
            onSelect={(id) => setChapterId(id)}
          />
        </div>
        <div className="h-[28rem]">
          <TaxonomyColumn
            title="Topics"
            kind="TOPIC"
            parentId={chapterId || undefined}
            parentLabel={chapterName}
            disabled={!chapterId}
            selectedId=""
            onSelect={() => undefined}
            selectable={false}
          />
        </div>
      </div>
    </div>
  );
}
