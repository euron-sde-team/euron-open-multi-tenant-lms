"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  cn,
} from "@open-mtlms/core";
import { Package, Plus, Pencil, Trash2, Check, X, Video, FileText, Download, Clock, Award, Users, Headphones, Book } from "lucide-react";
import { useState } from "react";

import { useCourseStore } from "@/lib/stores/course-store";

// Predefined icons for course offerings
const offeringIcons = [
  { id: "video", icon: Video, label: "Video" },
  { id: "file", icon: FileText, label: "File" },
  { id: "download", icon: Download, label: "Download" },
  { id: "clock", icon: Clock, label: "Duration" },
  { id: "award", icon: Award, label: "Certificate" },
  { id: "users", icon: Users, label: "Community" },
  { id: "headphones", icon: Headphones, label: "Support" },
  { id: "book", icon: Book, label: "Resources" },
];

interface OfferingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OfferingsModal({ open, onOpenChange }: OfferingsModalProps) {
  const { courseData, addOffering, updateOffering, removeOffering } = useCourseStore();

  const [editingOffering, setEditingOffering] = useState<string | null>(null);
  const [editIcon, setEditIcon] = useState("");
  const [editText, setEditText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newIcon, setNewIcon] = useState("video");
  const [newText, setNewText] = useState("");

  const handleStartEdit = (offering: { id: string; icon: string; text: string }) => {
    setEditingOffering(offering.id);
    setEditIcon(offering.icon);
    setEditText(offering.text);
  };

  const handleSaveEdit = () => {
    if (editingOffering && editText.trim()) {
      updateOffering(editingOffering, {
        icon: editIcon,
        text: editText.trim(),
      });
    }
    setEditingOffering(null);
    setEditIcon("");
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingOffering(null);
    setEditIcon("");
    setEditText("");
  };

  const handleAddOffering = () => {
    if (newText.trim()) {
      addOffering(newIcon, newText.trim());
      setNewText("");
      setNewIcon("video");
      setIsAdding(false);
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewText("");
    setNewIcon("video");
  };

  const getIconComponent = (iconId: string) => {
    const found = offeringIcons.find((i) => i.id === iconId);
    return found ? found.icon : Video;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            This Course Includes
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Add what students will get with this course
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3 pr-2">
          {/* Offerings List */}
          {courseData.offerings.map((offering) => {
            const IconComponent = getIconComponent(offering.icon);
            return (
              <div
                key={offering.id}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  "hover:border-primary/50 hover:bg-muted/50",
                  editingOffering === offering.id && "ring-2 ring-primary"
                )}
              >
                {editingOffering === offering.id ? (
                  <div className="flex-1 space-y-3">
                    {/* Icon Selection */}
                    <div className="space-y-2">
                      <Label className="text-xs">Icon</Label>
                      <div className="flex flex-wrap gap-2">
                        {offeringIcons.map((iconOption) => {
                          const Icon = iconOption.icon;
                          return (
                            <button
                              key={iconOption.id}
                              type="button"
                              className={cn(
                                "h-9 w-9 rounded-lg border flex items-center justify-center transition-colors",
                                editIcon === iconOption.id
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "hover:border-primary/50"
                              )}
                              onClick={() => setEditIcon(iconOption.id)}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Text Input */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="e.g., 10 hours on-demand video"
                        className="flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        onClick={handleSaveEdit}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <span className="flex-1">{offering.text}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleStartEdit(offering)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeOffering(offering.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Empty State */}
          {courseData.offerings.length === 0 && !isAdding && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No offerings added yet</p>
              <p className="text-sm">Add what students will get with this course</p>
            </div>
          )}

          {/* Add New Offering */}
          {isAdding ? (
            <div className="border rounded-lg p-4 space-y-3 border-primary ring-2 ring-primary bg-primary/5">
              {/* Icon Selection */}
              <div className="space-y-2">
                <Label className="text-xs">Select Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {offeringIcons.map((iconOption) => {
                    const Icon = iconOption.icon;
                    return (
                      <button
                        key={iconOption.id}
                        type="button"
                        className={cn(
                          "h-9 w-9 rounded-lg border flex items-center justify-center transition-colors",
                          newIcon === iconOption.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "hover:border-primary/50"
                        )}
                        onClick={() => setNewIcon(iconOption.id)}
                        title={iconOption.label}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Text Input */}
              <div className="flex items-center gap-2">
                <Input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="e.g., 10 hours on-demand video"
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddOffering();
                    if (e.key === "Escape") handleCancelAdd();
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddOffering}
                  disabled={!newText.trim()}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Add
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelAdd}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Offering
            </Button>
          )}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            {courseData.offerings.length} offering{courseData.offerings.length !== 1 ? "s" : ""}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
