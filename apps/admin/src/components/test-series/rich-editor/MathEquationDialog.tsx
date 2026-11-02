"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@open-mtlms/core";
import katex from "katex";
import { BookMarked } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { MathField, type MathFieldHandle } from "./MathField";
import { MathTemplatesToolbar } from "./MathTemplatesToolbar";
import { FORMULA_LIBRARY } from "./formula-library";

interface MathEquationDialogProps {
  open: boolean;
  initialLatex: string;
  displayMode: boolean;
  onCancel: () => void;
  onConfirm: (latex: string) => void;
}

/**
 * Modal for adding or editing a math equation. Authors get three ways to
 * build an equation without touching LaTeX:
 *   1. Type math naturally into the visual MathLive editor (1/2 → fraction).
 *   2. Pick from the curated Formula library (right panel), the formula
 *      drops into the editor where it can be tweaked visually.
 *   3. Paste raw LaTeX from elsewhere if they have it.
 * The live preview (top of dialog) renders exactly what the student will see.
 */
export function MathEquationDialog({
  open,
  initialLatex,
  displayMode,
  onCancel,
  onConfirm,
}: MathEquationDialogProps) {
  const [latex, setLatex] = useState(initialLatex);
  const [librarySearch, setLibrarySearch] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const mathfieldRef = useRef<MathFieldHandle>(null);

  useEffect(() => {
    if (open) {
      setLatex(initialLatex);
      setLibrarySearch("");
      setShowLibrary(false);
    }
  }, [open, initialLatex]);

  const previewHtml = useMemo(() => {
    if (!latex.trim()) return "";
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return "";
    }
  }, [latex, displayMode]);

  const filteredCategories = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return FORMULA_LIBRARY;
    return FORMULA_LIBRARY.map((cat) => ({
      ...cat,
      formulas: cat.formulas.filter((f) =>
        f.name.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.formulas.length > 0);
  }, [librarySearch]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className={cn("max-w-3xl", showLibrary && "max-w-5xl")}>
        <DialogHeader>
          <DialogTitle>
            {displayMode ? "Display equation" : "Inline equation"}
          </DialogTitle>
          <DialogDescription>
            Type the equation visually, fractions, exponents, and integrals
            appear as you type. No LaTeX knowledge required.
          </DialogDescription>
        </DialogHeader>

        <div className={cn("grid gap-4", showLibrary ? "grid-cols-2" : "grid-cols-1")}>
          {/* Editor pane */}
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Equation</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowLibrary((v) => !v)}
                  className="h-7"
                >
                  <BookMarked className="mr-1 h-3.5 w-3.5" />
                  {showLibrary ? "Hide library" : "Browse formulas"}
                </Button>
              </div>
              <MathField
                ref={mathfieldRef}
                value={latex}
                onChange={setLatex}
                placeholder="Type your equation here…"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                Templates, click to insert at cursor
              </Label>
              <div className="bg-muted/20 max-h-[220px] overflow-y-auto rounded-md border p-2">
                <MathTemplatesToolbar mathfieldRef={mathfieldRef} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Preview</Label>
              <div className="bg-muted/40 flex min-h-[60px] items-center justify-center rounded-md border p-3">
                {previewHtml ? (
                  <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Start typing to see the preview
                  </span>
                )}
              </div>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              Three ways to build the equation: click a <strong>Template</strong>{" "}
              above to insert structures (fraction, integral, matrix…); type
              naturally, <code>1/2</code> becomes a fraction, <code>x^2</code>{" "}
              becomes squared; or open <strong>Browse formulas</strong> to pick
              a complete formula. The on-screen virtual keyboard appears when
              you click into the equation field.
            </p>
          </div>

          {/* Formula library pane */}
          {showLibrary && (
            <div className="bg-muted/20 -m-2 rounded-md border p-3">
              <div className="mb-2 space-y-1">
                <Label>Formula library</Label>
                <Input
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search… (e.g. quadratic, area, derivative)"
                  className="h-8"
                />
              </div>
              <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {filteredCategories.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No formulas match.
                  </p>
                ) : (
                  filteredCategories.map((cat) => (
                    <div key={cat.name}>
                      <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wide">
                        {cat.name}
                      </p>
                      <div className="space-y-1">
                        {cat.formulas.map((f) => (
                          <FormulaRow
                            key={f.name}
                            name={f.name}
                            latex={f.latex}
                            onPick={() => setLatex(f.latex)}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(latex)}>Insert equation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormulaRow({
  name,
  latex,
  onPick,
}: {
  name: string;
  latex: string;
  onPick: () => void;
}) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return "";
    }
  }, [latex]);

  return (
    <button
      type="button"
      onClick={onPick}
      className="hover:bg-background flex w-full items-center justify-between gap-3 rounded-md p-2 text-left transition-colors"
    >
      <span className="text-foreground text-xs font-medium">{name}</span>
      <span
        className="text-muted-foreground line-clamp-1 text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </button>
  );
}
