"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Inbox,
  Loader2,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  MEMBER_FORM_FIELD_TYPES,
  type MemberFormField,
  type MemberFormFieldType,
  type MemberFormMode,
} from "@/lib/api/member-form";
import {
  useMemberForm,
  useUpdateMemberForm,
} from "@/lib/hooks/use-member-form";
import { useTenantStore } from "@/lib/stores/tenant-store";

const BASE = "/dashboard/settings/user-data-form";

const FIELD_TYPE_LABELS: Record<MemberFormFieldType, string> = {
  text: "Short text",
  textarea: "Paragraph",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  multiselect: "Multi-select",
  checkbox: "Checkbox",
  radio: "Radio buttons",
  url: "URL",
};

const OPTION_TYPES: MemberFormFieldType[] = ["select", "multiselect", "radio"];

const MODE_OPTIONS: { value: MemberFormMode; label: string; hint: string }[] = [
  {
    value: "OPTIONAL",
    label: "Optional",
    hint: "Users can skip it; it reappears after the re-prompt interval.",
  },
  {
    value: "MANDATORY",
    label: "Mandatory",
    hint: "Blocks the platform after login until completed (logout only).",
  },
];

function slugifyName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "f_$1");
}

function newField(index: number): MemberFormField {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `field-${index}-${Math.round(performance.now())}`;
  return {
    id,
    name: `field_${index + 1}`,
    label: "Untitled field",
    type: "text",
    required: false,
    order: index,
  };
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Please try again.";
}

export default function UserDataFormEditorPage() {
  const params = useParams();
  const formId = (params?.id as string) ?? "";
  const router = useRouter();
  const { selectedTenantId } = useTenantStore();
  const tenantId = selectedTenantId ?? undefined;
  const { toast } = useToast();

  const { data: config, isLoading, isError } = useMemberForm(tenantId, formId);
  const updateForm = useUpdateMemberForm(tenantId, formId);

  const [name, setName] = useState("");
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<MemberFormMode>("OPTIONAL");
  const [repromptAfterHours, setRepromptAfterHours] = useState(24);
  const [title, setTitle] = useState("Complete your profile");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<MemberFormField[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (config) {
      setName(config.name);
      setActive(config.active);
      setMode(config.mode);
      setRepromptAfterHours(config.repromptAfterHours);
      setTitle(config.title);
      setDescription(config.description ?? "");
      setFields([...config.fields].sort((a, b) => a.order - b.order));
      setIsDirty(false);
    }
  }, [config]);

  // Warn before navigating away from unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const markDirty = () => setIsDirty(true);

  const updateField = (index: number, patch: Partial<MemberFormField>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
    markDirty();
  };

  const addField = () => {
    setFields((prev) => [...prev, newField(prev.length)]);
    markDirty();
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const moveField = (index: number, dir: -1 | 1) => {
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markDirty();
  };

  const handleSave = () => {
    updateForm.mutate(
      {
        name: name.trim() || "Untitled form",
        active,
        mode,
        repromptAfterHours,
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        fields: fields.map((f, i) => ({ ...f, order: i })),
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          toast({ title: "Saved", description: "Form updated." });
        },
        onError: (err) =>
          toast({
            title: "Could not save",
            description: getErrorMessage(err),
            variant: "destructive",
          }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  if (isError || !config) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-muted-foreground">This form could not be found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(BASE)}
        >
          Back to forms
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={BASE}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {name || "Untitled form"}
              </h1>
              {active ? (
                <Badge variant={mode === "MANDATORY" ? "default" : "secondary"}>
                  {mode === "MANDATORY" ? "Mandatory" : "Optional"}
                </Badge>
              ) : (
                <Badge variant="outline">Inactive</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Collect custom details from users after they log in.
            </p>
          </div>
        </div>
        <Link href={`${BASE}/${formId}/responses`}>
          <Button variant="outline" size="sm">
            <Inbox className="mr-2 h-4 w-4" /> View responses
          </Button>
        </Link>
      </div>

      {/* Basics */}
      <Card>
        <CardHeader>
          <CardTitle>Form details</CardTitle>
          <CardDescription>
            A name to identify this form (only you see it) and how it appears to
            users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Form name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              placeholder="e.g. Onboarding details"
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">
                When on, this form is shown to users in the order set on the
                forms list.
              </p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={(v) => {
                setActive(v);
                markDirty();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v as MemberFormMode);
                markDirty();
              }}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {MODE_OPTIONS.find((o) => o.value === mode)?.hint}
            </p>
          </div>

          {mode === "OPTIONAL" && (
            <div className="space-y-2">
              <Label>Re-prompt after (hours)</Label>
              <Input
                type="number"
                min={1}
                max={8760}
                value={repromptAfterHours}
                onChange={(e) => {
                  setRepromptAfterHours(Number(e.target.value));
                  markDirty();
                }}
                className="w-full sm:w-40"
              />
              <p className="text-xs text-muted-foreground">
                After a user dismisses the form it stays hidden for this long,
                then reappears.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Form title</Label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markDirty();
              }}
              placeholder="Complete your profile"
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
              placeholder="Tell users why you need this information."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>
            Add the questions users should answer. Just give each field a label;
            we handle the field key for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.length === 0 && (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No fields yet. Add your first field below.
            </p>
          )}

          {fields.map((field, index) => (
            <FieldEditor
              key={field.id}
              field={field}
              index={index}
              total={fields.length}
              onChange={(patch) => updateField(index, patch)}
              onRemove={() => removeField(index)}
              onMove={(dir) => moveField(index, dir)}
            />
          ))}

          <Button variant="outline" onClick={addField} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add field
          </Button>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {isDirty ? "You have unsaved changes" : "All changes saved"}
          </p>
          <Button
            onClick={handleSave}
            disabled={!isDirty || updateForm.isPending}
          >
            {updateForm.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldEditor({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  field: MemberFormField;
  index: number;
  total: number;
  onChange: (patch: Partial<MemberFormField>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isOptionType = OPTION_TYPES.includes(field.type);
  const optionsText = (field.options ?? []).join("\n");
  const autoKey = slugifyName(field.label) || field.name;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <GripVertical className="h-4 w-4" />
          Field {index + 1}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label="Remove field"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="e.g. College name"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={field.type}
            onValueChange={(v) => onChange({ type: v as MemberFormFieldType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMBER_FORM_FIELD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Placeholder (optional)</Label>
          <Input
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
          />
        </div>
      </div>

      {isOptionType && (
        <div className="space-y-1.5">
          <Label>Options (one per line)</Label>
          <Textarea
            value={optionsText}
            onChange={(e) =>
              // Store the raw lines as-is so this stays the exact inverse of
              // `options.join("\n")`. Trimming/dropping empty lines here would
              // make the controlled value snap back and eat the newline the
              // user just typed (Enter/Shift+Enter). The backend normalizes
              // (trims + drops empty options) on save.
              onChange({ options: e.target.value.split("\n") })
            }
            rows={3}
            placeholder={"Option 1\nOption 2"}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={field.required}
            onCheckedChange={(v) => onChange({ required: v })}
          />
          <Label className="cursor-pointer">Required</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={field.halfWidth ?? false}
            onCheckedChange={(v) => onChange({ halfWidth: v })}
          />
          <Label className="cursor-pointer">Half width</Label>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Advanced
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
        />
      </button>
      {showAdvanced && (
        <div className="space-y-1.5 rounded-md bg-muted/40 p-3">
          <Label className="text-xs">Field key</Label>
          <Input
            value={field.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={autoKey}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Auto-generated from the label. Used as the column key in exports;
            change only if you have a reason to.
          </p>
        </div>
      )}
    </div>
  );
}
