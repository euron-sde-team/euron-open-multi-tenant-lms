"use client";

import { Plus, Pencil, GripVertical, X, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useIsEditMode } from "../../context";

interface EditableListProps {
  items: string[];
  onChange: (items: string[]) => void;
  className?: string;
  itemClassName?: string;
  placeholder?: string;
  addLabel?: string;
  emptyMessage?: string;
  maxItems?: number;
  icon?: React.ReactNode;
  renderItem?: (item: string, index: number) => React.ReactNode;
}

/**
 * Editable list component that renders a static list when not in edit mode,
 * and allows adding/editing/removing items when in edit mode.
 */
export function EditableList({
  items,
  onChange,
  className,
  itemClassName,
  placeholder = "New item...",
  addLabel = "Add item",
  emptyMessage = "No items added yet",
  maxItems,
  icon,
  renderItem,
}: EditableListProps) {
  const isEditMode = useIsEditMode();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState("");

  const canAddMore = !maxItems || items.length < maxItems;

  const handleStartEdit = (index: number) => {
    if (isEditMode) {
      setEditingIndex(index);
      setEditValue(items[index]);
    }
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editValue.trim()) {
      const newItems = [...items];
      newItems[editingIndex] = editValue.trim();
      onChange(newItems);
    }
    setEditingIndex(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleAddItem = () => {
    if (newValue.trim() && canAddMore) {
      onChange([...items, newValue.trim()]);
      setNewValue("");
      setIsAdding(false);
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, isNew: boolean) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isNew) {
        handleAddItem();
      } else {
        handleSaveEdit();
      }
    }
    if (e.key === "Escape") {
      if (isNew) {
        handleCancelAdd();
      } else {
        handleCancelEdit();
      }
    }
  };

  // If not in edit mode, just render the list
  if (!isEditMode) {
    if (items.length === 0) {
      return null;
    }
    return (
      <ul className={cn("space-y-2", className)}>
        {items.map((item, index) => (
          <li key={index} className={cn("flex items-start gap-2 min-w-0", itemClassName)}>
            {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}
            {renderItem ? renderItem(item, index) : <span className="min-w-0 flex-1 break-words">{item}</span>}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Items List */}
      {items.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground italic py-2">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={index}
              className={cn(
                "group flex items-start gap-2 min-w-0 rounded-lg p-2 transition-colors",
                "hover:bg-muted/50",
                editingIndex === index && "bg-muted/50",
                itemClassName
              )}
            >
              {/* Drag Handle */}
              <GripVertical className="h-4 w-4 flex-shrink-0 mt-0.5 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100" />

              {/* Icon */}
              {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}

              {/* Content */}
              {editingIndex === index ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, false)}
                    className="min-w-0 flex-1 bg-transparent outline-none border-b-2 border-primary px-1"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="flex-shrink-0 p-1 rounded hover:bg-primary/10 text-primary"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-shrink-0 p-1 rounded hover:bg-destructive/10 text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="min-w-0 flex-1 cursor-text break-words hover:text-primary"
                    onClick={() => handleStartEdit(index)}
                  >
                    {renderItem ? renderItem(item, index) : item}
                  </span>
                  <button
                    onClick={() => handleStartEdit(index)}
                    className="flex-shrink-0 p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="flex-shrink-0 p-1 rounded hover:bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add New Item */}
      {isAdding ? (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          {icon && <span className="flex-shrink-0 opacity-50">{icon}</span>}
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none px-1"
            autoFocus
          />
          <button
            onClick={handleAddItem}
            disabled={!newValue.trim()}
            className="p-1 rounded hover:bg-primary/10 text-primary disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancelAdd}
            className="p-1 rounded hover:bg-destructive/10 text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        canAddMore && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-muted-foreground/25 px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        )
      )}

      {/* Max items notice */}
      {maxItems && items.length >= maxItems && (
        <p className="text-xs text-muted-foreground text-center">
          Maximum {maxItems} items allowed
        </p>
      )}
    </div>
  );
}
