"use client";

import { Button, useToast } from "@open-mtlms/core";
import {
  AutoFitName,
  CERTIFICATE_PAGE_DIMENSIONS,
  useCertificateFonts,
  type CertificateData,
  type CertificateDesign,
  type CertificateElement,
  type CertificateOrientation,
  type CertificatePageSize,
  type CertificateVariable,
} from "@open-mtlms/certificate-templates";
import {
  Image as ImageIcon,
  Loader2,
  Plus,
  QrCode,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { certificateDesignerApi } from "@/lib/api/certificate-designer";

const SAMPLE_DATA: CertificateData = {
  certificateNumber: "CERT-ABCD-1234",
  courseTitle: "Advanced React Development",
  firstName: "Jane",
  lastName: "Doe",
  formattedIssuedAt: "January 15, 2026",
  directorName: "A. Director",
  directorTitle: "Program Director",
  logoUrl: null,
  verifyUrl: "https://verify.example.com/CERT-ABCD-1234",
  testSeriesTitle: "Full Stack Test Series",
  hoursText: "12 hours",
  lessonsCompleted: 24,
  quizzesPassed: 6,
  finalScore: "88%",
  expiryText: "January 15, 2028",
  signatureUrl: null,
  tenantName: "Qultima Academy",
};

const VARIABLE_OPTIONS: { value: CertificateVariable; label: string }[] = [
  { value: "participantName", label: "Participant name" },
  { value: "courseTitle", label: "Course name" },
  { value: "testSeriesTitle", label: "Test series name" },
  { value: "certificateNumber", label: "Certificate number" },
  { value: "formattedIssuedAt", label: "Date" },
  { value: "hoursText", label: "Hours" },
  { value: "lessonsCompleted", label: "Lessons completed" },
  { value: "quizzesPassed", label: "Quizzes passed" },
  { value: "finalScore", label: "Final score" },
  { value: "expiryText", label: "Expiry" },
  { value: "directorName", label: "Signatory name" },
  { value: "directorTitle", label: "Signatory title" },
  { value: "tenantName", label: "Organization name" },
];

function preview(variable: CertificateVariable): string {
  const d = SAMPLE_DATA;
  const map: Record<CertificateVariable, string> = {
    participantName: `${d.firstName} ${d.lastName}`,
    firstName: d.firstName,
    lastName: d.lastName,
    courseTitle: d.courseTitle,
    testSeriesTitle: d.testSeriesTitle ?? "",
    certificateNumber: d.certificateNumber,
    formattedIssuedAt: d.formattedIssuedAt,
    expiryText: d.expiryText ?? "",
    // Mirror ConfigCertificateRenderer: render just the number (strip a trailing
    // hours unit) so the designer preview matches the issued certificate.
    hoursText: (d.hoursText ?? "").replace(/\s*(hours?|hrs?)\.?\s*$/i, "").trim(),
    lessonsCompleted: String(d.lessonsCompleted ?? ""),
    quizzesPassed: String(d.quizzesPassed ?? ""),
    finalScore: d.finalScore ?? "",
    directorName: d.directorName,
    directorTitle: d.directorTitle,
    tenantName: d.tenantName ?? "",
  };
  return map[variable] ?? "";
}

function elementText(el: CertificateElement): string {
  if (el.type === "variable") {
    return (el.prefix ?? "") + preview(el.variable) + (el.suffix ?? "");
  }
  if (el.type === "text") return el.value;
  return "";
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `el-${Math.round(Math.random() * 1e9)}`;
}

const DEFAULT_DESIGN: CertificateDesign = {
  page: { size: "A4", orientation: "LANDSCAPE" },
  background: { assetUrl: null, color: "#ffffff" },
  elements: [],
};

// Mirror ConfigCertificateRenderer so the designer canvas shrinks long variable
// values exactly the way the issued certificate does (WYSIWYG). Kept in sync
// with the renderer's LINE_HEIGHT / VARIABLE_MAX_LINES / REM_PX / MIN_FONT_PX.
const CERT_LINE_HEIGHT = 1.15;
const CERT_VARIABLE_MAX_LINES = 2;
const CERT_REM_PX = 16;
const CERT_MIN_FONT_PX = 8;

interface Props {
  initialName?: string;
  initialDesign?: CertificateDesign;
  saving?: boolean;
  onSave: (name: string, design: CertificateDesign) => void;
}

export function CertificateDesigner({
  initialName = "",
  initialDesign,
  saving = false,
  onSave,
}: Props) {
  const { toast } = useToast();
  // Load the shared certificate fonts (incl. signature/handwriting faces) so
  // the canvas preview matches the issued certificate exactly.
  useCertificateFonts();
  const [name, setName] = useState(initialName);
  const [design, setDesign] = useState<CertificateDesign>(
    initialDesign ?? DEFAULT_DESIGN,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<
    "background" | "image" | null
  >(null);
  const [lockAspect, setLockAspect] = useState(true);

  const dims =
    CERTIFICATE_PAGE_DIMENSIONS[design.page.size][design.page.orientation];
  const scale = Math.min(1, 760 / dims.width);

  // Natural width/height ratios captured from each image's onLoad, so aspect
  // lock works without the user having to enter a height.
  const ratiosRef = useRef<Record<string, number>>({});

  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize";
    kind: CertificateElement["type"];
    startX: number;
    startY: number;
    elX: number;
    elY: number;
    elW: number;
    elH: number;
    ratio: number;
    lock: boolean;
  } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      // Stop the browser's own text/image drag from fighting ours.
      e.preventDefault();
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      if (drag.mode === "move") {
        updateElement(drag.id, {
          x: Math.max(0, Math.round(drag.elX + dx)),
          y: Math.max(0, Math.round(drag.elY + dy)),
        });
        return;
      }
      // resize
      if (drag.kind === "qr") {
        const size = Math.max(24, Math.round(drag.elW + dx));
        updateElement(drag.id, { size } as Partial<CertificateElement>);
      } else if (drag.kind === "image") {
        const width = Math.max(24, Math.round(drag.elW + dx));
        const height =
          drag.lock && drag.ratio > 0
            ? Math.max(12, Math.round(width / drag.ratio))
            : Math.max(12, Math.round(drag.elH + dy));
        updateElement(drag.id, {
          width,
          height,
        } as Partial<CertificateElement>);
      } else {
        const width = Math.max(40, Math.round(drag.elW + dx));
        updateElement(drag.id, { width });
      }
    }
    function onUp() {
      dragRef.current = null;
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  const selectedEl = useMemo(
    () => design.elements.find((e) => e.id === selectedId) ?? null,
    [design.elements, selectedId],
  );

  function updateElement(id: string, patch: Partial<CertificateElement>) {
    setDesign((prev) => ({
      ...prev,
      elements: prev.elements.map((e) =>
        e.id === id ? ({ ...e, ...patch } as CertificateElement) : e,
      ),
    }));
  }

  /** Current on-canvas box size of an element (unscaled px). */
  function elemSize(el: CertificateElement): { w: number; h: number } {
    if (el.type === "qr") return { w: el.size ?? 96, h: el.size ?? 96 };
    if (el.type === "image") {
      const w = el.width ?? 160;
      const ratio = ratiosRef.current[el.id];
      const h = el.height ?? (ratio ? Math.round(w / ratio) : 100);
      return { w, h };
    }
    return { w: el.width ?? 240, h: Math.round((el.fontSize ?? 16) * 1.3) };
  }

  function startMove(el: CertificateElement, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(el.id);
    const { w, h } = elemSize(el);
    dragRef.current = {
      id: el.id,
      mode: "move",
      kind: el.type,
      startX: e.clientX,
      startY: e.clientY,
      elX: el.x,
      elY: el.y,
      elW: w,
      elH: h,
      ratio: h > 0 ? w / h : 1,
      lock: lockAspect,
    };
    document.body.style.userSelect = "none";
  }

  function startResize(el: CertificateElement, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(el.id);
    const { w, h } = elemSize(el);
    const natural = ratiosRef.current[el.id];
    dragRef.current = {
      id: el.id,
      mode: "resize",
      kind: el.type,
      startX: e.clientX,
      startY: e.clientY,
      elX: el.x,
      elY: el.y,
      elW: w,
      elH: h,
      ratio: natural && natural > 0 ? natural : h > 0 ? w / h : 1,
      lock: lockAspect,
    };
    document.body.style.userSelect = "none";
  }

  function addElement(el: CertificateElement) {
    setDesign((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }

  function addVariable(variable: CertificateVariable) {
    // Signatory name defaults to a handwriting/script font so it reads like a
    // real signature out of the box. Lead with the web fonts useCertificateFonts
    // actually loads (Marck Script, Mea Culpa) so it renders identically off-Mac
    // and in the server-side render, then fall back to OS-local script faces.
    const isSignatureName = variable === "directorName";
    addElement({
      id: newId(),
      type: "variable",
      variable,
      x: Math.round(dims.width / 2 - 120),
      y: 120,
      width: 240,
      align: "center",
      fontSize: isSignatureName ? 34 : 28,
      color: "#111827",
      fontFamily: isSignatureName
        ? "'Marck Script', 'Mea Culpa', 'Snell Roundhand', 'Apple Chancery', 'Segoe Script', 'Brush Script MT', cursive"
        : "Georgia, serif",
    });
  }

  function addText() {
    addElement({
      id: newId(),
      type: "text",
      value: "Certificate of Completion",
      x: Math.round(dims.width / 2 - 160),
      y: 60,
      width: 320,
      align: "center",
      fontSize: 22,
      color: "#374151",
      fontFamily: "Georgia, serif",
    });
  }

  function addQr() {
    addElement({
      id: newId(),
      type: "qr",
      x: 64,
      y: dims.height - 150,
      size: 96,
    });
  }

  async function uploadFor(kind: "background" | "image") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingKind(kind);
      try {
        const url = await certificateDesignerApi.uploadAsset(
          file,
          kind === "background" ? "background" : "logo",
        );
        if (kind === "background") {
          setDesign((prev) => ({
            ...prev,
            background: { ...prev.background, assetUrl: url },
          }));
        } else {
          addElement({
            id: newId(),
            type: "image",
            assetUrl: url,
            x: Math.round(dims.width / 2 - 80),
            y: 300,
            width: 160,
          });
        }
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
      } finally {
        setUploadingKind(null);
      }
    };
    input.click();
  }

  function elementStyle(el: CertificateElement): React.CSSProperties {
    return {
      position: "absolute",
      left: el.x,
      top: el.y,
      width: el.width,
      textAlign: el.align ?? "left",
      fontFamily: el.fontFamily,
      fontSize: el.fontSize,
      fontWeight: el.fontWeight,
      color: el.color,
      fontStyle: el.italic ? "italic" : undefined,
      letterSpacing: el.letterSpacing,
      cursor: "move",
      whiteSpace: "pre-wrap",
      lineHeight: 1.15,
      userSelect: "none",
      WebkitUserSelect: "none",
      outline: el.id === selectedId ? "2px solid #6366f1" : "1px dashed transparent",
      outlineOffset: 2,
    };
  }

  function handleSave() {
    if (!name.trim()) {
      toast({ title: "Give the template a name", variant: "destructive" });
      return;
    }
    onSave(name.trim(), design);
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col gap-4 lg:flex-row">
      {/* Left: elements palette */}
      <div className="w-full shrink-0 space-y-3 lg:w-56">
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Add element
          </p>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={addText}
              className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Type className="h-3.5 w-3.5" /> Text
            </button>
            <button
              type="button"
              onClick={() => uploadFor("image")}
              disabled={uploadingKind === "image"}
              className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
            >
              {uploadingKind === "image" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              {uploadingKind === "image" ? "Uploading…" : "Image / logo"}
            </button>
            <button
              type="button"
              onClick={addQr}
              className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted"
            >
              <QrCode className="h-3.5 w-3.5" /> QR (verify)
            </button>
          </div>
          <p className="mb-2 mt-3 text-xs font-semibold uppercase text-muted-foreground">
            Variables
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {VARIABLE_OPTIONS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => addVariable(v.value)}
                className="flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs hover:bg-muted"
              >
                <Plus className="h-3 w-3 shrink-0" /> {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Center: canvas */}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="h-9 min-w-48 flex-1 rounded-md border px-3 text-sm"
          />
          <select
            value={design.page.size}
            onChange={(e) =>
              setDesign((p) => ({
                ...p,
                page: { ...p.page, size: e.target.value as CertificatePageSize },
              }))
            }
            className="h-9 rounded-md border px-2 text-sm"
          >
            <option value="A4">A4</option>
            <option value="LETTER">Letter</option>
          </select>
          <select
            value={design.page.orientation}
            onChange={(e) =>
              setDesign((p) => ({
                ...p,
                page: {
                  ...p.page,
                  orientation: e.target.value as CertificateOrientation,
                },
              }))
            }
            className="h-9 rounded-md border px-2 text-sm"
          >
            <option value="LANDSCAPE">Landscape</option>
            <option value="PORTRAIT">Portrait</option>
          </select>
          <button
            type="button"
            onClick={() => uploadFor("background")}
            disabled={uploadingKind === "background"}
            className="flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60"
          >
            {uploadingKind === "background" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            {uploadingKind === "background" ? "Uploading…" : "Background"}
          </button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>

        <div className="overflow-auto rounded-lg border bg-muted/30 p-4">
          <div
            style={{ width: dims.width * scale, height: dims.height * scale }}
            onMouseDown={() => setSelectedId(null)}
          >
            <div
              style={{
                position: "relative",
                width: dims.width,
                height: dims.height,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                overflow: "hidden",
                backgroundColor: design.background?.color ?? "#ffffff",
                backgroundImage: design.background?.assetUrl
                  ? `url(${design.background.assetUrl})`
                  : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
              }}
            >
              {design.elements.map((el) => {
                if (el.type === "image") {
                  return (
                    <img
                      key={el.id}
                      src={el.assetUrl}
                      alt=""
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      onLoad={(ev) => {
                        const img = ev.currentTarget;
                        if (img.naturalWidth && img.naturalHeight) {
                          ratiosRef.current[el.id] =
                            img.naturalWidth / img.naturalHeight;
                          // Seed a height from the natural ratio the first time
                          // so the box matches the image (no squish).
                          if (el.height == null) {
                            updateElement(el.id, {
                              height: Math.round(
                                (el.width ?? 160) /
                                  (img.naturalWidth / img.naturalHeight),
                              ),
                            } as Partial<CertificateElement>);
                          }
                        }
                      }}
                      onMouseDown={(e) => startMove(el, e)}
                      style={{
                        position: "absolute",
                        left: el.x,
                        top: el.y,
                        width: el.width,
                        height: el.height,
                        objectFit: "fill",
                        cursor: "move",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        outline:
                          el.id === selectedId ? "2px solid #6366f1" : undefined,
                      }}
                    />
                  );
                }
                if (el.type === "qr") {
                  return (
                    <div
                      key={el.id}
                      onMouseDown={(e) => startMove(el, e)}
                      style={{
                        position: "absolute",
                        left: el.x,
                        top: el.y,
                        width: el.size ?? 96,
                        height: el.size ?? 96,
                        cursor: "move",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid #d1d5db",
                        background: "#fff",
                        fontSize: 10,
                        color: "#6b7280",
                        outline:
                          el.id === selectedId ? "2px solid #6366f1" : undefined,
                      }}
                    >
                      QR
                    </div>
                  );
                }
                if (el.type === "variable") {
                  // Same auto-shrink as the issued certificate: the value wraps
                  // up to 2 lines then scales down, so a long name previews at
                  // the size it will actually render, not the literal fontSize.
                  const maxRem = (el.fontSize ?? 16) / CERT_REM_PX;
                  return (
                    <div
                      key={el.id}
                      onMouseDown={(e) => startMove(el, e)}
                      style={elementStyle(el)}
                    >
                      <AutoFitName
                        // Remount on width change so a resize re-fits (the fit
                        // effect keys on font/text, not box width).
                        key={el.width}
                        text={elementText(el)}
                        maxRem={maxRem}
                        minRem={Math.min(maxRem, CERT_MIN_FONT_PX / CERT_REM_PX)}
                        lineHeight={CERT_LINE_HEIGHT}
                        maxLines={CERT_VARIABLE_MAX_LINES}
                        style={{ margin: 0, width: "100%" }}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => startMove(el, e)}
                    style={elementStyle(el)}
                  >
                    {elementText(el)}
                  </div>
                );
              })}

              {/* Resize handle for the selected element (drag the corner). */}
              {selectedEl && (
                <div
                  onMouseDown={(e) => startResize(selectedEl, e)}
                  title="Drag to resize"
                  style={{
                    position: "absolute",
                    left:
                      selectedEl.x + elemSize(selectedEl).w - 7,
                    top: selectedEl.y + elemSize(selectedEl).h - 7,
                    width: 14,
                    height: 14,
                    background: "#6366f1",
                    border: "2px solid #ffffff",
                    borderRadius: 3,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                    cursor: "nwse-resize",
                    zIndex: 20,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: properties */}
      <div className="w-full shrink-0 lg:w-64">
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Properties
          </p>
          {!selectedEl ? (
            <p className="text-xs text-muted-foreground">
              Select an element on the canvas to edit it.
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              {selectedEl.type === "text" && (
                <label className="block">
                  <span className="text-xs text-muted-foreground">Text</span>
                  <input
                    value={selectedEl.value}
                    onChange={(e) =>
                      updateElement(selectedEl.id, { value: e.target.value })
                    }
                    className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                  />
                </label>
              )}
              {selectedEl.type === "variable" && (
                <label className="block">
                  <span className="text-xs text-muted-foreground">Variable</span>
                  <select
                    value={selectedEl.variable}
                    onChange={(e) =>
                      updateElement(selectedEl.id, {
                        variable: e.target.value as CertificateVariable,
                      })
                    }
                    className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                  >
                    {VARIABLE_OPTIONS.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(selectedEl.type === "variable" || selectedEl.type === "text") && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-muted-foreground">Size</span>
                      <input
                        type="number"
                        value={selectedEl.fontSize ?? 16}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            fontSize: Number(e.target.value),
                          })
                        }
                        className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-muted-foreground">Color</span>
                      <input
                        type="color"
                        value={selectedEl.color ?? "#111827"}
                        onChange={(e) =>
                          updateElement(selectedEl.id, { color: e.target.value })
                        }
                        className="mt-1 h-8 w-full rounded-md border"
                      />
                    </label>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="block flex-1">
                      <span className="text-xs text-muted-foreground">Align</span>
                      <select
                        value={selectedEl.align ?? "left"}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            align: e.target.value as "left" | "center" | "right",
                          })
                        }
                        className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <label className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!selectedEl.italic}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            italic: e.target.checked,
                          })
                        }
                        className="accent-primary h-3.5 w-3.5"
                      />
                      <span className="italic">Italic</span>
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Font</span>
                    <select
                      value={selectedEl.fontFamily ?? "Georgia, serif"}
                      onChange={(e) =>
                        updateElement(selectedEl.id, {
                          fontFamily: e.target.value,
                        })
                      }
                      className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                    >
                      <optgroup label="Signature (handwriting)">
                        <option value="'Snell Roundhand', 'Marck Script', 'Segoe Script', 'Brush Script MT', cursive">
                          Signature, handwriting
                        </option>
                        <option value="'Apple Chancery', 'Mea Culpa', 'Segoe Script', 'Brush Script MT', cursive">
                          Signature, calligraphy
                        </option>
                      </optgroup>
                      <optgroup label="Serif">
                        <option value="Georgia, serif">Serif</option>
                        <option value="'Playfair Display', serif">Playfair</option>
                        <option value="'Cormorant Garamond', serif">Cormorant</option>
                        <option value="'Fraunces', serif">Fraunces</option>
                        <option value="'EB Garamond', serif">EB Garamond</option>
                      </optgroup>
                      <optgroup label="Sans / Mono">
                        <option value="Arial, sans-serif">Sans</option>
                        <option value="'Manrope', sans-serif">Manrope</option>
                        <option value="'Courier New', monospace">Mono</option>
                      </optgroup>
                    </select>
                  </label>
                </>
              )}
              {selectedEl.type === "qr" && (
                <label className="block">
                  <span className="text-xs text-muted-foreground">Size</span>
                  <input
                    type="number"
                    value={selectedEl.size ?? 96}
                    onChange={(e) =>
                      updateElement(selectedEl.id, {
                        size: Number(e.target.value),
                      } as Partial<CertificateElement>)
                    }
                    className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                  />
                </label>
              )}
              {selectedEl.type === "image" && (
                <>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={lockAspect}
                      onChange={(e) => setLockAspect(e.target.checked)}
                      className="accent-primary h-3.5 w-3.5"
                    />
                    Lock aspect ratio
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-muted-foreground">
                        Width
                      </span>
                      <input
                        type="number"
                        value={selectedEl.width ?? 160}
                        onChange={(e) => {
                          const w = Math.max(8, Number(e.target.value) || 0);
                          const ratio =
                            ratiosRef.current[selectedEl.id] ??
                            (selectedEl.width ?? 160) /
                              (selectedEl.height ?? 100);
                          updateElement(
                            selectedEl.id,
                            (lockAspect && ratio > 0
                              ? { width: w, height: Math.round(w / ratio) }
                              : { width: w }) as Partial<CertificateElement>,
                          );
                        }}
                        className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-muted-foreground">
                        Height
                      </span>
                      <input
                        type="number"
                        value={
                          selectedEl.height ??
                          Math.round(
                            (selectedEl.width ?? 160) /
                              (ratiosRef.current[selectedEl.id] ?? 1.6),
                          )
                        }
                        onChange={(e) => {
                          const h = Math.max(8, Number(e.target.value) || 0);
                          const ratio =
                            ratiosRef.current[selectedEl.id] ??
                            (selectedEl.width ?? 160) /
                              (selectedEl.height ?? 100);
                          updateElement(
                            selectedEl.id,
                            (lockAspect && ratio > 0
                              ? { height: h, width: Math.round(h * ratio) }
                              : { height: h }) as Partial<CertificateElement>,
                          );
                        }}
                        className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                      />
                    </label>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-muted-foreground">X</span>
                  <input
                    type="number"
                    value={selectedEl.x}
                    onChange={(e) =>
                      updateElement(selectedEl.id, { x: Number(e.target.value) })
                    }
                    className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">Y</span>
                  <input
                    type="number"
                    value={selectedEl.y}
                    onChange={(e) =>
                      updateElement(selectedEl.id, { y: Number(e.target.value) })
                    }
                    className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDesign((prev) => ({
                    ...prev,
                    elements: prev.elements.filter((e) => e.id !== selectedEl.id),
                  }));
                  setSelectedId(null);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete element
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
