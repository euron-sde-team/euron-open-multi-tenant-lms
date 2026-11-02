"use client";

import { Button } from "@open-mtlms/core";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

interface ExportColumn {
  key: string;
  label: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface ExportMenuProps {
  data: AnyRow[];
  fileName: string;
  sheetName?: string;
  columns?: ExportColumn[];
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  /**
   * Optional async row provider. When given, export fetches the full set on
   * click (e.g. all filtered rows, not just the loaded page) instead of using
   * the static `data` prop. `data` is still used to decide the empty/disabled
   * state and as a fallback if the fetch returns nothing.
   */
  getData?: () => Promise<AnyRow[]>;
  /**
   * Optional rich-report builder. When given, an extra "Excel report, charts &
   * insights" item appears that delegates entirely to this callback (it does its
   * own data fetch + workbook build + download).
   */
  buildReport?: { label?: string; run: () => Promise<void> };
  /**
   * Hide the CSV item, leaves only the Excel export. When this collapses the
   * menu to a single Excel action, the button triggers it directly (no dropdown).
   */
  hideCsv?: boolean;
}

function exportToCSV(data: AnyRow[], fileName: string, columns?: ExportColumn[]) {
  if (!data.length) return;
  const keys = columns?.map((c) => c.key) ?? Object.keys(data[0]);
  const headers = columns?.map((c) => c.label) ?? keys;

  const escapeCSV = (val: unknown): string => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [
    headers.map(escapeCSV).join(","),
    ...data.map((row) => keys.map((k) => escapeCSV(row[k])).join(",")),
  ].join("\n");

  const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToExcel(data: AnyRow[], fileName: string, sheetName: string, columns?: ExportColumn[]) {
  if (!data.length) return;

  let sheetData = data;
  if (columns) {
    sheetData = data.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const col of columns) {
        mapped[col.label] = row[col.key];
      }
      return mapped;
    });
  }

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const colWidths = Object.keys(sheetData[0] ?? {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...sheetData.map((row) => String(row[key] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws["!cols"] = colWidths;

  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function ExportMenu({
  data,
  fileName,
  sheetName = "Sheet1",
  columns,
  disabled,
  variant = "outline",
  size = "sm",
  getData,
  buildReport,
  hideCsv = false,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = useCallback(async (format: "xlsx" | "csv") => {
    setExporting(true);
    try {
      const rows = getData ? await getData() : data;
      if (!rows.length) return;
      if (format === "csv") {
        exportToCSV(rows, fileName, columns);
      } else {
        exportToExcel(rows, fileName, sheetName, columns);
      }
    } finally {
      setExporting(false);
      setOpen(false);
    }
  }, [data, fileName, sheetName, columns, getData]);

  const handleReport = useCallback(async () => {
    if (!buildReport) return;
    setExporting(true);
    try {
      await buildReport.run();
    } finally {
      setExporting(false);
      setOpen(false);
    }
  }, [buildReport]);

  // The Excel action (rich report if provided, else plain xlsx).
  const runExcel = buildReport ? handleReport : () => handleExport("xlsx");
  // With CSV hidden, Excel is the only item, the button fires it directly.
  const excelOnly = hideCsv;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant={variant}
        size={size}
        className="gap-1.5"
        onClick={excelOnly ? runExcel : () => setOpen(!open)}
        disabled={disabled || exporting || (!getData && !buildReport && !data.length)}
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">Export</span>
      </Button>

      {!excelOnly && open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md">
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            onClick={runExcel}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            {buildReport?.label ?? "Excel (.xlsx)"}
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            onClick={() => handleExport("csv")}
          >
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            CSV (.csv)
          </button>
        </div>
      )}
    </div>
  );
}
