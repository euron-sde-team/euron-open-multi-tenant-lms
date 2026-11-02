"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
  Separator,
  Switch,
  useToast,
} from "@open-mtlms/core";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  LayoutList,
  Monitor,
  Palette,
  Plus,
  Redo2,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
  Upload,
} from "lucide-react";
import { useState } from "react";

import { useEditorStore } from "@/lib/stores/editor-store";
import type { PreviewDevice } from "@/lib/stores/editor-store";

import { AiGenerateDialog } from "./ai-generate-dialog";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

const DEVICE_PRESETS: {
  id: PreviewDevice;
  label: string;
  shortLabel: string;
  icon: typeof Smartphone;
}[] = [
  { id: "iphoneSE", label: "iPhone SE (375 x 667)", shortLabel: "SE", icon: Smartphone },
  { id: "iphone14", label: "iPhone 14 (390 x 844)", shortLabel: "14", icon: Smartphone },
  { id: "ipad", label: "iPad (768 x 1024)", shortLabel: "iPad", icon: Tablet },
  { id: "ipadPro", label: "iPad Pro (1024 x 1366)", shortLabel: "Pro", icon: Tablet },
  { id: "desktop", label: "Desktop (Full width)", shortLabel: "Desktop", icon: Monitor },
];

interface EditorToolbarProps {
  /** Whether the current page is the homepage - Theme settings only available on homepage */
  isHomePage?: boolean;
}

export function EditorToolbar({ isHomePage = false }: EditorToolbarProps) {
  const {
    isEditMode,
    toggleEditMode,
    history,
    undo,
    redo,
    toggleSectionPanel,
    toggleThemePanel,
    toggleContentPanel,
    isSectionPanelOpen,
    isThemePanelOpen,
    isContentPanelOpen,
    exportConfig,
    importConfig,
    previewDevice,
    setPreviewDevice,
  } = useEditorStore();

  const { toast } = useToast();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAiGenerateOpen, setIsAiGenerateOpen] = useState(false);
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const [importJson, setImportJson] = useState("");
  const [exportedJson, setExportedJson] = useState("");

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Currently-selected device (falls back to Desktop) for the compact picker.
  const activeDevice =
    DEVICE_PRESETS.find((d) => d.id === previewDevice) ?? DEVICE_PRESETS[4];
  const ActiveDeviceIcon = activeDevice.icon;

  const _handleExport = () => {
    const json = exportConfig();
    setExportedJson(json);
    setIsExportDialogOpen(true);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(exportedJson);
    toast({
      title: "Copied!",
      description: "Configuration copied to clipboard",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([exportedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "page-config.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: "Configuration saved to file",
    });
  };

  const handleImport = () => {
    const success = importConfig(importJson);
    if (success) {
      toast({
        title: "Imported!",
        description: "Configuration imported successfully",
      });
      setIsImportDialogOpen(false);
      setImportJson("");
    } else {
      toast({
        title: "Error",
        description:
          "Failed to import configuration. Please check the JSON format.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* Toolbar content - rendered inline, not fixed */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Edit Mode Toggle */}
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5">
          <Switch
            id="edit-mode"
            checked={isEditMode}
            onCheckedChange={toggleEditMode}
          />
          <Label htmlFor="edit-mode" className="text-sm font-medium cursor-pointer">
            {isEditMode ? "Edit" : "Preview"}
          </Label>
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="h-9 w-9"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="h-9 w-9"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* Device Preview Picker, dropdown keeps all 5 devices in one compact
            control so the toolbar never overflows. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5">
              <ActiveDeviceIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{activeDevice.shortLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {DEVICE_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isActive = previewDevice === preset.id;
              return (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => setPreviewDevice(preset.id)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-sm">{preset.shortLabel}</span>
                  {isActive && <Check className="h-4 w-4 shrink-0 opacity-70" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-8" />

        {/* Add Section */}
        <Button
          variant={isSectionPanelOpen ? "default" : "outline"}
          size="sm"
          onClick={toggleSectionPanel}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Section</span>
        </Button>

        {/* Content, show/hide catalog listings (courses, books, test series…) */}
        <Button
          variant={isContentPanelOpen ? "default" : "outline"}
          size="sm"
          onClick={toggleContentPanel}
          className="gap-2"
        >
          <LayoutList className="h-4 w-4" />
          <span className="hidden sm:inline">Content</span>
        </Button>

        {/* AI Generate */}
        {aiAuthoringEnabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAiGenerateOpen(true)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI Generate</span>
          </Button>
        )}

        {/* Theme Button - Only on home page (global theme applies site-wide) */}
        {isHomePage && (
          <Button
            variant={isThemePanelOpen ? "default" : "outline"}
            size="sm"
            onClick={toggleThemePanel}
            className="gap-2"
          >
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </Button>
        )}

        {/* Preview Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleEditMode}
          className="gap-2"
        >
          {isEditMode ? (
            <>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </>
          )}
        </Button>

      </div>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Export Configuration</DialogTitle>
            <DialogDescription>
              Copy the JSON configuration or download it as a file.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto rounded-lg bg-muted p-4">
            <pre className="text-sm">{exportedJson}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCopyToClipboard}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Configuration</DialogTitle>
            <DialogDescription>
              Paste your JSON configuration below to import it.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[300px] w-full rounded-lg border bg-muted p-4 font-mono text-sm"
            placeholder="Paste your JSON configuration here..."
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importJson.trim()}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <AiGenerateDialog
        open={isAiGenerateOpen}
        onOpenChange={setIsAiGenerateOpen}
        scope="page"
      />
    </>
  );
}
