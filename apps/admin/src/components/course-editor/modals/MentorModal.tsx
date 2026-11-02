"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  cn,
} from "@open-mtlms/core";
import { Search, User, Check, X, Loader2 } from "lucide-react";
import { useState } from "react";

import { useInstructors } from "@/lib/hooks/use-instructors";
import { useCourseStore } from "@/lib/stores/course-store";
import { useTenantStore } from "@/lib/stores/tenant-store";

interface MentorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MentorModal({ open, onOpenChange }: MentorModalProps) {
  const { courseData, addInstructor, removeInstructor } = useCourseStore();
  const { selectedTenantId } = useTenantStore();
  const { data: instructorsData, isLoading } = useInstructors(selectedTenantId ?? undefined);
  const [searchQuery, setSearchQuery] = useState("");

  const instructorIds = courseData.instructorIds || [];
  const allInstructors = instructorsData?.instructors ?? [];

  const selectedInstructors = allInstructors.filter((i) => instructorIds.includes(i.id));

  const filteredInstructors = allInstructors.filter(
    (instructor) =>
      instructor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (instructor.expertise ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (instructor.email ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleInstructor = (instructorId: string) => {
    if (instructorIds.includes(instructorId)) {
      removeInstructor(instructorId);
    } else {
      addInstructor(instructorId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Select Course Mentors
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose one or more mentors to instruct this course
          </p>
        </DialogHeader>

        {/* Selected Mentors */}
        {selectedInstructors.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-4 border-b">
            {selectedInstructors.map((instructor) => (
              <div
                key={instructor.id}
                className="flex items-center gap-2 bg-primary/10 text-primary rounded-full pl-1 pr-3 py-1"
              >
                {instructor.profileUrl ? (
                  <img
                    src={instructor.profileUrl}
                    alt={instructor.name}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="text-sm font-medium">{instructor.name}</span>
                <button
                  onClick={() => removeInstructor(instructor.id)}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mentors by name, expertise, or email..."
            className="pl-9"
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Mentors Grid */}
        {!isLoading && filteredInstructors.length > 0 && (
          <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {filteredInstructors.map((instructor) => {
              const isSelected = instructorIds.includes(instructor.id);
              return (
                <div
                  key={instructor.id}
                  className={cn(
                    "relative rounded-lg border p-4 cursor-pointer transition-all",
                    "hover:border-primary/50 hover:shadow-md",
                    isSelected && "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2"
                  )}
                  onClick={() => toggleInstructor(instructor.id)}
                >
                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                  )}

                  {/* Instructor Info */}
                  <div className="flex gap-4">
                    {instructor.profileUrl ? (
                      <img
                        src={instructor.profileUrl}
                        alt={instructor.name}
                        className="h-16 w-16 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{instructor.name}</h4>
                      {instructor.expertise && (
                        <p className="text-sm text-muted-foreground truncate">
                          {instructor.expertise}
                        </p>
                      )}
                    </div>
                  </div>
                  {instructor.bio && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                      {instructor.bio}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty states */}
        {!isLoading && allInstructors.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground py-12">
            <p>No instructors yet, create one in the Instructors section</p>
          </div>
        )}

        {!isLoading && allInstructors.length > 0 && filteredInstructors.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground py-12">
            <p>No mentors found matching &quot;{searchQuery}&quot;</p>
          </div>
        )}

        <DialogFooter className="mt-4 pt-4 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            {selectedInstructors.length} mentor{selectedInstructors.length !== 1 ? "s" : ""} selected
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
