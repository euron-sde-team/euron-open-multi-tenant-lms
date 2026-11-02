"use client";

import { Button, Input } from "@open-mtlms/core";
import { Plus, X } from "lucide-react";

interface DynamicStringListProps {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
}

export function DynamicStringList({
  label,
  placeholder,
  values,
  onChange,
}: DynamicStringListProps) {
  const addItem = () => {
    onChange([...values, ""]);
  };

  const removeItem = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    const updated = [...values];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeItem(index)}
            className="text-muted-foreground hover:text-foreground h-9 w-9 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add
      </Button>
    </div>
  );
}
