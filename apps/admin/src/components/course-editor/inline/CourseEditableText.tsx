"use client";

import { cn } from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { Pencil } from "lucide-react";
import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";

import { useCourseEditMode } from "@/lib/contexts/course-edit-mode-context";

interface CourseEditableTextProps {
  value: string;
  onChange: (value: string) => void;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  inputClassName?: string;
  showEditIcon?: boolean;
  style?: React.CSSProperties;
}

export function CourseEditableText({
  value,
  onChange,
  as: Component = "span",
  className,
  placeholder = "Click to edit...",
  multiline = false,
  maxLength,
  inputClassName,
  showEditIcon = false,
  style,
}: CourseEditableTextProps) {
  const { isEditMode } = useCourseEditMode();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const lastValueRef = useRef(value);

  // Update local state when value prop changes
  useEffect(() => {
    if (value !== lastValueRef.current && !isEditing) {
      setEditValue(value);
      lastValueRef.current = value;
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditMode) {
        e.stopPropagation();
        setIsEditing(true);
        setEditValue(value);
      }
    },
    [isEditMode, value]
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const trimmedValue = editValue.trim() || value;
    if (trimmedValue !== value) {
      onChange(trimmedValue);
      lastValueRef.current = trimmedValue;
    }
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        handleBlur();
      }
      if (e.key === "Escape") {
        setEditValue(value);
        setIsEditing(false);
      }
    },
    [multiline, handleBlur, value]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
      setEditValue(newValue);
    },
    [maxLength]
  );

  const handleInputClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // If not in edit mode, just render the text
  if (!isEditMode) {
    return <Component className={className} style={style}>{decodeHtmlEntities(value) || placeholder}</Component>;
  }

  // If editing, show input
  if (isEditing) {
    const InputComponent = multiline ? "textarea" : "input";
    return (
      <InputComponent
        ref={inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>}
        value={editValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full bg-transparent outline-none focus:outline-none",
          "border-b-2 border-primary",
          multiline && "min-h-[100px] resize-y",
          inputClassName,
          className
        )}
        placeholder={placeholder}
        onClick={handleInputClick}
      />
    );
  }

  // Show editable text with hover state
  return (
    <Component
      className={cn(
        "group relative cursor-text transition-all",
        "hover:bg-primary/10 hover:outline hover:outline-2 hover:outline-primary/50 hover:outline-offset-2 rounded",
        className
      )}
      style={style}
      onClick={handleClick}
    >
      {decodeHtmlEntities(value) || <span className="text-muted-foreground/50 italic">{placeholder}</span>}
      {showEditIcon && (
        <span className="ml-2 inline-flex opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil className="h-3 w-3 text-primary" />
        </span>
      )}
    </Component>
  );
}
