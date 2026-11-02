"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  useToast,
} from "@open-mtlms/core";
import { Loader2, RefreshCw, Save, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { TestModuleWithQuestions, TestScoreScale } from "@/lib/api/test-series";
import {
  useAutoGenerateScoreScales,
  useSaveScoreScales,
} from "@/lib/hooks/use-test-series";

interface ScoreScaleEditorProps {
  testId: string;
  sectionId: string;
  sectionName: string;
  modules: TestModuleWithQuestions[];
  scales: TestScoreScale[];
}

function pathLabel(pathKey: string): string {
  if (!pathKey) return "Single stage";
  return pathKey
    .split(">")
    .map((v) => v.charAt(0) + v.slice(1).toLowerCase())
    .join(" > ");
}

/**
 * Optional SAT-style raw-to-scaled conversion tables, one per routing path.
 * Auto-generate creates monotone defaults (easier paths capped below
 * scale_max, like the digital SAT's lower-route tables); every cell stays
 * editable afterward.
 */
export function ScoreScaleEditor({
  testId,
  sectionId,
  sectionName,
  modules,
  scales,
}: ScoreScaleEditorProps) {
  const { toast } = useToast();
  const saveMut = useSaveScoreScales();
  const generateMut = useAutoGenerateScoreScales();

  const [scaleMaxInput, setScaleMaxInput] = useState("800");
  const [draft, setDraft] = useState<
    Array<{ pathKey: string; scaleMax: number; cells: string[] }>
  >([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(
      scales.map((s) => ({
        pathKey: s.pathKey,
        scaleMax: s.scaleMax,
        cells: s.scale.map((v) => String(v)),
      }))
    );
    setDirty(false);
    if (scales.length > 0) setScaleMaxInput(String(scales[0].scaleMax));
  }, [scales]);

  const hasModules = modules.length > 0;
  const pending = saveMut.isPending || generateMut.isPending;

  const maxRows = useMemo(
    () => draft.reduce((m, d) => Math.max(m, d.cells.length), 0),
    [draft]
  );

  const setCell = (pathIdx: number, cellIdx: number, value: string) => {
    setDraft((prev) =>
      prev.map((d, i) =>
        i === pathIdx
          ? { ...d, cells: d.cells.map((c, j) => (j === cellIdx ? value : c)) }
          : d
      )
    );
    setDirty(true);
  };

  const handleGenerate = () => {
    const scaleMax = parseInt(scaleMaxInput, 10);
    if (!Number.isFinite(scaleMax) || scaleMax < 1) {
      toast({ title: "Scale max must be at least 1", variant: "destructive" });
      return;
    }
    generateMut.mutate(
      { testId, sectionId, scaleMax },
      {
        onSuccess: () => toast({ title: `Score scales generated for ${sectionName}` }),
        onError: (err) =>
          toast({
            title: "Generation failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const handleSave = () => {
    const payload: Array<{ path_key: string; scale: number[]; scale_max: number }> = [];
    for (const d of draft) {
      const values: number[] = [];
      for (let i = 0; i < d.cells.length; i++) {
        const v = parseInt(d.cells[i], 10);
        if (!Number.isInteger(v) || v < 0 || v > d.scaleMax) {
          toast({
            title: `Invalid value in ${pathLabel(d.pathKey)} at raw ${i}`,
            description: `Values must be integers between 0 and ${d.scaleMax}.`,
            variant: "destructive",
          });
          return;
        }
        if (values.length > 0 && v < values[values.length - 1]) {
          toast({
            title: `${pathLabel(d.pathKey)} is not monotone at raw ${i}`,
            description: "Each value must be >= the previous one.",
            variant: "destructive",
          });
          return;
        }
        values.push(v);
      }
      payload.push({ path_key: d.pathKey, scale: values, scale_max: d.scaleMax });
    }
    saveMut.mutate(
      { testId, sectionId, scales: payload },
      {
        onSuccess: () => {
          setDirty(false);
          toast({ title: "Score scales saved" });
        },
        onError: (err) =>
          toast({
            title: "Save failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const handleClear = () => {
    saveMut.mutate(
      { testId, sectionId, scales: [] },
      {
        onSuccess: () => toast({ title: "Scaled scoring removed for this section" }),
      }
    );
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm">Score conversion (optional)</CardTitle>
          <p className="text-muted-foreground text-xs">
            Converts raw correct answers into a scaled score, one table per
            routing path. This is what caps the easier path below the harder one.
            Leave empty to score by marks only. (The percentile chart is set
            separately, below.)
          </p>
        </div>
        {draft.length > 0 && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={pending || !hasModules}
              title="Regenerate defaults (overwrites edits)"
            >
              {generateMut.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              Regenerate
            </Button>
            <Button size="sm" onClick={handleSave} disabled={pending || !dirty}>
              {saveMut.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-1 h-3 w-3" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              disabled={pending}
              title="Remove scaled scoring"
            >
              <Trash2 className="text-destructive h-3 w-3" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {draft.length === 0 ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Scale max (e.g. 800)</Label>
              <Input
                type="number"
                min={1}
                value={scaleMaxInput}
                onChange={(e) => setScaleMaxInput(e.target.value)}
                className="h-8 w-28"
              />
            </div>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={pending || !hasModules}
            >
              {generateMut.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="mr-1 h-3 w-3" />
              )}
              Auto-generate
            </Button>
            {!hasModules && (
              <p className="text-muted-foreground text-xs">
                Add modules first, then generate.
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-72 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Raw correct</th>
                  {draft.map((d) => (
                    <th key={d.pathKey} className="px-2 py-1.5 text-left font-medium">
                      {pathLabel(d.pathKey)}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        / {d.scaleMax}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }, (_, row) => (
                  <tr key={row} className="border-t">
                    <td className="text-muted-foreground px-2 py-0.5">{row}</td>
                    {draft.map((d, pathIdx) => (
                      <td key={d.pathKey} className="px-2 py-0.5">
                        {row < d.cells.length ? (
                          <Input
                            value={d.cells[row]}
                            onChange={(e) => setCell(pathIdx, row, e.target.value)}
                            className="h-6 w-20 px-1 text-xs"
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
