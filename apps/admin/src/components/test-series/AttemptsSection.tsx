"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@open-mtlms/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Collapsible wrapper around the attempts table, shared by the test and series
 * reports so both behave identically.
 *
 * It exists because the block sits at the bottom of an already long page: it
 * needs a title that says it holds scores and answers rather than proctoring,
 * a count that stays readable when folded, and a toggle obvious enough to find.
 */
export function AttemptsSection({
  description,
  count,
  loading,
  children,
  collapsible = true,
  defaultOpen = true,
}: {
  description: ReactNode;
  /** Attempts loaded, shown in the header so the section reads when collapsed. */
  count: number;
  loading?: boolean;
  children: ReactNode;
  /**
   * Off when the section owns a whole tab: a toggle that empties the only
   * thing on screen is just a dead end.
   */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = collapsible ? open : true;

  return (
    <Card>
      <CardHeader
        className={
          collapsible
            ? "hover:bg-muted/40 cursor-pointer rounded-t-lg transition-colors"
            : undefined
        }
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              Learner attempts and answers
              {!loading && (
                <Badge variant="secondary" className="font-normal">
                  {count} {count === 1 ? "attempt" : "attempts"}
                </Badge>
              )}
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          </div>
          {collapsible && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 font-medium"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              aria-expanded={open}
            >
              {open ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  Hide attempts
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  Show attempts
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      {expanded && <CardContent>{children}</CardContent>}
    </Card>
  );
}
