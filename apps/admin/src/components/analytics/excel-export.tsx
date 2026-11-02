"use client";

import { Button } from "@open-mtlms/core";
import { Download, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import * as XLSX from "xlsx";

interface ExcelExportProps {
  data: Record<string, unknown>[];
  fileName: string;
  sheetName?: string;
  label?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
}

export function ExcelExportButton({
  data,
  fileName,
  sheetName = "Sheet1",
  label = "Export Excel",
  disabled,
  variant = "outline",
  size = "sm",
}: ExcelExportProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(() => {
    if (!data.length) return;
    setExporting(true);
    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const colWidths = Object.keys(data[0] ?? {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...data.map((row) => String(row[key] ?? "").length)
        );
        return { wch: Math.min(maxLen + 2, 50) };
      });
      ws["!cols"] = colWidths;

      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, [data, fileName, sheetName]);

  return (
    <Button
      variant={variant}
      size={size}
      className="gap-1.5"
      onClick={handleExport}
      disabled={disabled || exporting || !data.length}
    >
      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

export function exportToExcel(
  data: Record<string, unknown>[],
  fileName: string,
  sheetName = "Sheet1"
) {
  if (!data.length) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/** Size each column to its widest cell so wide reports stay readable on open. */
function autoFitColumns(
  ws: XLSX.WorkSheet,
  data: Record<string, unknown>[]
): void {
  const keys = Object.keys(data[0] ?? {});
  if (!keys.length) return;
  ws["!cols"] = keys.map((key) => {
    const maxLen = Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
}

/**
 * Write a workbook with one tab per sheet, skipping empty ones.
 * Returns the number of tabs written, 0 means nothing was downloaded, so the
 * caller can tell the user instead of appearing to do nothing.
 */
export function exportMultiSheetExcel(
  sheets: Array<{ name: string; data: Record<string, unknown>[] }>,
  fileName: string
): number {
  const wb = XLSX.utils.book_new();
  let written = 0;
  for (const sheet of sheets) {
    if (!sheet.data.length) continue;
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    autoFitColumns(ws, sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    written++;
  }
  if (!written) return 0;
  XLSX.writeFile(wb, `${fileName}.xlsx`);
  return written;
}
