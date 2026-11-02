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
import { Loader2, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { TestNormTable } from "@/lib/api/test-series";
import {
  useAutoGenerateNormTable,
  useSaveNormTable,
} from "@/lib/hooks/use-test-series";

interface NormTableEditorProps {
  testId: string;
  normTable: TestNormTable | null;
}

/**
 * Optional SAT-style score-to-percentile concordance for the whole test. When
 * present, results report a stable percentile from the first attempt instead of
 * the peer-relative fallback. Maps total scaled score to percentile (0 to 100).
 */
export function NormTableEditor({ testId, normTable }: NormTableEditorProps) {
  const { toast } = useToast();
  const saveMut = useSaveNormTable();
  const generateMut = useAutoGenerateNormTable();

  const [maxScoreInput, setMaxScoreInput] = useState("1600");
  const [rows, setRows] = useState<Array<{ score: string; percentile: string }>>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setRows(
      (normTable?.points ?? []).map((p) => ({
        score: String(p.score),
        percentile: String(p.percentile),
      }))
    );
    setDirty(false);
    if (normTable) setMaxScoreInput(String(normTable.maxScore));
  }, [normTable]);

  const pending = saveMut.isPending || generateMut.isPending;
  const maxScore = parseInt(maxScoreInput, 10);

  const setCell = (idx: number, field: "score" | "percentile", value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    setDirty(true);
  };
  const addRow = () => {
    setRows((prev) => [...prev, { score: "", percentile: "" }]);
    setDirty(true);
  };
  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleGenerate = () => {
    if (!Number.isFinite(maxScore) || maxScore < 1) {
      toast({ title: "Max score must be at least 1", variant: "destructive" });
      return;
    }
    generateMut.mutate(
      { testId, maxScore },
      {
        onSuccess: () => toast({ title: "Percentile curve generated" }),
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
    if (!Number.isFinite(maxScore) || maxScore < 1) {
      toast({ title: "Max score must be at least 1", variant: "destructive" });
      return;
    }
    const points: Array<{ score: number; percentile: number }> = [];
    for (let i = 0; i < rows.length; i++) {
      const score = parseInt(rows[i].score, 10);
      const percentile = parseFloat(rows[i].percentile);
      if (!Number.isFinite(score) || score < 0 || score > maxScore) {
        toast({
          title: `Row ${i + 1}: score must be between 0 and ${maxScore}`,
          variant: "destructive",
        });
        return;
      }
      if (!Number.isFinite(percentile) || percentile < 0 || percentile > 100) {
        toast({
          title: `Row ${i + 1}: percentile must be between 0 and 100`,
          variant: "destructive",
        });
        return;
      }
      if (points.length > 0 && score <= points[points.length - 1].score) {
        toast({
          title: `Row ${i + 1}: score must be greater than the previous row`,
          variant: "destructive",
        });
        return;
      }
      if (points.length > 0 && percentile < points[points.length - 1].percentile) {
        toast({
          title: `Row ${i + 1}: percentile must not decrease`,
          variant: "destructive",
        });
        return;
      }
      points.push({ score, percentile });
    }
    saveMut.mutate(
      { testId, points: points.length > 0 ? points : null, maxScore },
      {
        onSuccess: () => {
          setDirty(false);
          toast({
            title: points.length > 0 ? "Percentile table saved" : "Percentile table cleared",
          });
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
      { testId, points: null, maxScore: Number.isFinite(maxScore) ? maxScore : 1 },
      { onSuccess: () => toast({ title: "Percentile table removed" }) }
    );
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm">Percentile norm table (optional)</CardTitle>
          <p className="text-muted-foreground text-xs">
            SAT-style score-to-percentile concordance for the whole test. When set,
            results show a stable percentile from the first attempt instead of a peer
            comparison.
          </p>
        </div>
        <div className="flex items-end gap-1">
          <div className="space-y-1">
            <Label className="text-xs">Max score</Label>
            <Input
              type="number"
              min={1}
              value={maxScoreInput}
              onChange={(e) => setMaxScoreInput(e.target.value)}
              className="h-8 w-24"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={pending}
            title="Generate a linear default curve"
          >
            {generateMut.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="mr-1 h-3 w-3" />
            )}
            Auto-generate
          </Button>
          {rows.length > 0 && (
            <>
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
                title="Remove percentile table"
              >
                <Trash2 className="text-destructive h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-muted-foreground text-xs">
              No percentile table yet. Auto-generate a starting curve or add points
              manually.
            </p>
            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus className="mr-1 h-3 w-3" />
              Add point
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Scaled score</th>
                    <th className="px-2 py-1.5 text-left font-medium">Percentile</th>
                    <th className="w-8 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-0.5">
                        <Input
                          type="number"
                          value={r.score}
                          onChange={(e) => setCell(idx, "score", e.target.value)}
                          className="h-6 w-24 px-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-0.5">
                        <Input
                          type="number"
                          value={r.percentile}
                          onChange={(e) => setCell(idx, "percentile", e.target.value)}
                          className="h-6 w-24 px-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove point"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus className="mr-1 h-3 w-3" />
              Add point
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
