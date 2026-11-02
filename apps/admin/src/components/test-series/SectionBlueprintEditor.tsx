"use client";

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-mtlms/core";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { BlueprintRule, SectionBlueprint } from "@/lib/api/test-series";
import { testQuestionBanksApi } from "@/lib/api/test-series";
import {
  useCheckBlueprintAvailability,
  useTaxonomy,
} from "@/lib/hooks/use-test-series";

const ANY = "__ANY__";

function RuleRow({
  rule,
  onChange,
  onRemove,
  avail,
}: {
  rule: BlueprintRule;
  onChange: (r: BlueprintRule) => void;
  onRemove: () => void;
  avail?: { available: number; short: number };
}) {
  const { data: subjects = [] } = useTaxonomy("SUBJECT");
  const { data: chapters = [] } = useTaxonomy(
    "CHAPTER",
    rule.subjectNodeId || undefined
  );
  const { data: topics = [] } = useTaxonomy(
    "TOPIC",
    rule.chapterNodeId || undefined
  );

  return (
    <div className="border-border/60 space-y-2 rounded-md border p-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select
          value={rule.subjectNodeId ?? ""}
          onValueChange={(v) =>
            onChange({ ...rule, subjectNodeId: v, chapterNodeId: null, topicNodeId: null })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={rule.chapterNodeId ?? ""}
          onValueChange={(v) => onChange({ ...rule, chapterNodeId: v, topicNodeId: null })}
          disabled={!rule.subjectNodeId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chapter (any)" />
          </SelectTrigger>
          <SelectContent>
            {chapters.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={rule.topicNodeId ?? ""}
          onValueChange={(v) => onChange({ ...rule, topicNodeId: v })}
          disabled={!rule.chapterNodeId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Topic (any)" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={rule.difficulty && rule.difficulty !== "ANY" ? rule.difficulty : ANY}
          onValueChange={(v) =>
            onChange({
              ...rule,
              difficulty: v === ANY ? "ANY" : (v as BlueprintRule["difficulty"]),
            })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any difficulty</SelectItem>
            <SelectItem value="EASY">Easy</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HARD">Hard</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={rule.mode ?? "COUNT"}
          onValueChange={(v) => onChange({ ...rule, mode: v as "COUNT" | "PERCENT" })}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COUNT">Count</SelectItem>
            <SelectItem value="PERCENT">Percent</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={0}
          className="w-24"
          value={rule.value ?? ""}
          placeholder={rule.mode === "PERCENT" ? "%" : "#"}
          onChange={(e) =>
            onChange({ ...rule, value: e.target.value ? Number(e.target.value) : 0 })
          }
        />

        {avail && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              avail.short > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {avail.short > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                Only {avail.available} available
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {avail.available} available
              </>
            )}
          </span>
        )}

        <button
          type="button"
          className="text-muted-foreground hover:text-destructive ml-auto"
          onClick={onRemove}
          aria-label="Remove rule"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function SectionBlueprintEditor({
  value,
  onChange,
  bankId,
  onBankChange,
}: {
  value: SectionBlueprint | null;
  onChange: (v: SectionBlueprint | null) => void;
  bankId?: string;
  onBankChange?: (bankId: string) => void;
}) {
  const availMut = useCheckBlueprintAvailability();
  const [avail, setAvail] = useState<
    Record<number, { available: number; short: number }>
  >({});
  const [banks, setBanks] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBankId, setSelectedBankId] = useState(bankId ?? "");

  useEffect(() => {
    let cancelled = false;
    testQuestionBanksApi.list().then((res) => {
      if (cancelled) return;
      const items = res.banks.map((b) => ({ id: b.id, name: b.name }));
      setBanks(items);
      setSelectedBankId((prev) => prev || bankId || items[0]?.id || "");
    });
    return () => {
      cancelled = true;
    };
  }, [bankId]);

  // Persist the chosen bank to the parent so the section pools from it.
  useEffect(() => {
    if (selectedBankId) onBankChange?.(selectedBankId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBankId]);

  // Auto-refresh availability (subject/chapter/topic + difficulty) whenever the
  // bank or a rule changes, so counts stay visible without a manual click.
  useEffect(() => {
    const rs = value?.rules ?? [];
    if (!selectedBankId || rs.length === 0) return;
    const t = setTimeout(() => {
      availMut.mutate(
        { questionBankId: selectedBankId, totalCount: value?.totalCount, rules: rs },
        {
          onSuccess: (res) => {
            const map: Record<number, { available: number; short: number }> = {};
            res?.rules.forEach((r, i) => {
              map[i] = { available: r.available, short: r.short };
            });
            setAvail(map);
          },
        }
      );
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBankId, JSON.stringify(value?.rules ?? []), value?.totalCount]);

  if (!value) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange({ rules: [{ mode: "COUNT", value: 1, difficulty: "ANY" }] })}
      >
        <Plus className="mr-1 h-4 w-4" />
        Add question blueprint
      </Button>
    );
  }

  const rules = value.rules ?? [];
  const setRule = (i: number, r: BlueprintRule) =>
    onChange({ ...value, rules: rules.map((x, idx) => (idx === i ? r : x)) });
  const addRule = () =>
    onChange({ ...value, rules: [...rules, { mode: "COUNT", value: 1, difficulty: "ANY" }] });
  const removeRule = (i: number) =>
    onChange({ ...value, rules: rules.filter((_, idx) => idx !== i) });

  const check = () => {
    if (!selectedBankId) return;
    availMut.mutate(
      { questionBankId: selectedBankId, totalCount: value.totalCount, rules },
      {
        onSuccess: (res) => {
          const map: Record<number, { available: number; short: number }> = {};
          res?.rules.forEach((r, i) => {
            map[i] = { available: r.available, short: r.short };
          });
          setAvail(map);
        },
      }
    );
  };

  return (
    <div className="bg-muted/20 space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-foreground text-xs font-semibold">
          Question blueprint, pick these counts per attempt
        </p>
        <button
          type="button"
          className="text-muted-foreground hover:text-destructive text-xs"
          onClick={() => onChange(null)}
        >
          Remove
        </button>
      </div>

      <div className="space-y-2">
        {rules.map((r, i) => (
          <RuleRow
            key={i}
            rule={r}
            avail={avail[i]}
            onChange={(nr) => setRule(i, nr)}
            onRemove={() => removeRule(i)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={addRule}>
          <Plus className="mr-1 h-4 w-4" />
          Add rule
        </Button>
        <Select value={selectedBankId} onValueChange={setSelectedBankId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Bank to check" />
          </SelectTrigger>
          <SelectContent>
            {banks.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={check}
          disabled={!selectedBankId || rules.length === 0 || availMut.isPending}
        >
          {availMut.isPending ? "Checking…" : "Check availability"}
        </Button>
      </div>
    </div>
  );
}
