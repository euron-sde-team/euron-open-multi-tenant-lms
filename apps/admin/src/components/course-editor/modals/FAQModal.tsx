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
import { HelpCircle, Plus, Pencil, Trash2, GripVertical, Check, X } from "lucide-react";
import { useState } from "react";

import { useCourseStore } from "@/lib/stores/course-store";

interface FAQModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FAQModal({ open, onOpenChange }: FAQModalProps) {
  const { courseData, addFAQ, updateFAQ, removeFAQ } = useCourseStore();

  const [editingFAQ, setEditingFAQ] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  const handleStartEdit = (faq: { id: string; question: string; answer: string }) => {
    setEditingFAQ(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
  };

  const handleSaveEdit = () => {
    if (editingFAQ && editQuestion.trim() && editAnswer.trim()) {
      updateFAQ(editingFAQ, {
        question: editQuestion.trim(),
        answer: editAnswer.trim(),
      });
    }
    setEditingFAQ(null);
    setEditQuestion("");
    setEditAnswer("");
  };

  const handleCancelEdit = () => {
    setEditingFAQ(null);
    setEditQuestion("");
    setEditAnswer("");
  };

  const handleAddFAQ = () => {
    if (newQuestion.trim() && newAnswer.trim()) {
      addFAQ(newQuestion.trim(), newAnswer.trim());
      setNewQuestion("");
      setNewAnswer("");
      setIsAdding(false);
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewQuestion("");
    setNewAnswer("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Add common questions and answers about your course
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-2">
          {/* FAQ List */}
          {courseData.faqs.map((faq, index) => (
            <div
              key={faq.id}
              className={cn(
                "group border rounded-lg overflow-hidden",
                editingFAQ === faq.id && "ring-2 ring-primary"
              )}
            >
              {editingFAQ === faq.id ? (
                <div className="p-4 space-y-4 bg-muted/50">
                  <div className="space-y-2">
                    <Label htmlFor="edit-question">Question</Label>
                    <Input
                      id="edit-question"
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                      placeholder="Enter the question..."
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-answer">Answer</Label>
                    <textarea
                      id="edit-answer"
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      placeholder="Enter the answer..."
                      rows={4}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={!editQuestion.trim() || !editAnswer.trim()}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <GripVertical className="h-5 w-5 mt-0.5 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          Q{index + 1}
                        </span>
                      </div>
                      <h4 className="font-medium">{faq.question}</h4>
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {faq.answer}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleStartEdit(faq)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeFAQ(faq.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Empty State */}
          {courseData.faqs.length === 0 && !isAdding && (
            <div className="text-center py-8 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No FAQs added yet</p>
              <p className="text-sm">Add frequently asked questions to help students</p>
            </div>
          )}

          {/* Add New FAQ */}
          {isAdding ? (
            <div className="border rounded-lg p-4 space-y-4 border-primary ring-2 ring-primary bg-primary/5">
              <div className="space-y-2">
                <Label htmlFor="new-question">Question</Label>
                <Input
                  id="new-question"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="What is this course about?"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-answer">Answer</Label>
                <textarea
                  id="new-answer"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="This course covers..."
                  rows={4}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelAdd}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddFAQ}
                  disabled={!newQuestion.trim() || !newAnswer.trim()}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Add FAQ
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
              Add FAQ
            </Button>
          )}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            {courseData.faqs.length} FAQ{courseData.faqs.length !== 1 ? "s" : ""}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
