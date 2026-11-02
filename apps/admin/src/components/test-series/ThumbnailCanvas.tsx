"use client";

import { Button, Input, useToast } from "@open-mtlms/core";
import type Konva from "konva";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Eraser,
  Image as ImageIcon,
  Italic,
  Loader2,
  Lock,
  Plus,
  Square,
  Trash2,
  Type as TypeIcon,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";

import { uploadApi } from "@/lib/api/upload";

// Editor renders at this display size; exports at 16:9 1280×720.
const STAGE_W = 860;
const STAGE_H = Math.round((STAGE_W * 9) / 16);
const EXPORT_W = 1280;

const FONTS = [
  { label: "Inter", value: "Inter, Arial, sans-serif" },
  { label: "Arial Black", value: "'Arial Black', Arial, sans-serif" },
  { label: "Impact", value: "Impact, Charcoal, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
];

type ImageItem = {
  id: string;
  type: "image";
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  lockRatio: boolean;
};
type TextItem = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fill: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  stroke: string | null;
  strokeWidth: number;
  rotation: number;
};
type RectItem = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  cornerRadius: number;
  opacity: number;
  rotation: number;
};
type Item = ImageItem | TextItem | RectItem;

let _id = 0;
const nextId = () => `l${++_id}-${STAGE_W}`;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Natural pixel dimensions of an image src. */
function imageDims(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = src;
  });
}

/** Loads a src into an HTMLImageElement so Konva can draw it. */
function useHtmlImage(src: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    const onLoad = () => setImg(image);
    image.addEventListener("load", onLoad);
    return () => image.removeEventListener("load", onLoad);
  }, [src]);
  return img;
}

function BackgroundImage({ src }: { src: string }) {
  const img = useHtmlImage(src);
  if (!img) return null;
  const scale = Math.max(STAGE_W / img.width, STAGE_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  return (
    <KonvaImage
      image={img}
      x={(STAGE_W - w) / 2}
      y={(STAGE_H - h) / 2}
      width={w}
      height={h}
      listening={false}
    />
  );
}

function EditableImage({
  item,
  onRef,
  onChange,
  onSelect,
  onReady,
}: {
  item: ImageItem;
  onRef: (node: Konva.Node | null) => void;
  onChange: (patch: Partial<ImageItem>) => void;
  onSelect: () => void;
  onReady: () => void;
}) {
  const img = useHtmlImage(item.src);
  useEffect(() => {
    if (img) onReady();
  }, [img, onReady]);
  if (!img) return null;
  return (
    <KonvaImage
      ref={onRef}
      image={img}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      rotation={item.rotation}
      opacity={item.opacity}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Image;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(20, node.width() * sx),
          height: Math.max(20, node.height() * sy),
          rotation: node.rotation(),
        });
      }}
    />
  );
}

export interface ThumbnailCanvasProps {
  initialSrc?: string | null;
  onSave: (key: string) => void;
  onCancel: () => void;
}

/** Small labelled colour swatch. */
function ColorField({
  label,
  value,
  onChange,
  title,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  title?: string;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground" title={title}>
      {label}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 cursor-pointer rounded border"
      />
    </label>
  );
}

export default function ThumbnailCanvas({ onSave, onCancel }: ThumbnailCanvasProps) {
  const { toast } = useToast();
  const [bgColor, setBgColor] = useState("#0f172a");
  const [bgSrc, setBgSrc] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bgRemovingId, setBgRemovingId] = useState<string | null>(null);
  const [bgProgress, setBgProgress] = useState(0);

  const removeBg = async (item: ImageItem) => {
    setBgRemovingId(item.id);
    setBgProgress(0);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(item.src, {
        // Small quantized model → ~10MB download (vs ~40MB default), much faster.
        model: "isnet_quint8",
        progress: (_key, current, total) => {
          if (total > 0) setBgProgress(Math.round((current / total) * 100));
        },
      });
      patchItem(item.id, { src: await blobToDataUrl(blob) });
      toast({ title: "Background removed" });
    } catch (e) {
      toast({
        title: "Couldn't remove background",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBgRemovingId(null);
      setBgProgress(0);
    }
  };

  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  // Bumped whenever a photo finishes loading, so the Transformer re-attaches to
  // the now-rendered node (Konva images load async, otherwise handles only
  // appear after the first drag).
  const [loadTick, setLoadTick] = useState(0);
  const handleImageReady = useCallback(() => setLoadTick((t) => t + 1), []);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, items, loadTick]);

  const patchItem = (id: string, patch: Partial<Item>) =>
    setItems((prev) =>
      prev.map((i) => (i.id === id ? ({ ...i, ...patch } as Item) : i)),
    );

  const removeSelected = () => {
    if (!selectedId) return;
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    delete nodeRefs.current[selectedId];
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const id = nextId();
    setItems((prev) => [...prev, { ...selected, id, x: selected.x + 24, y: selected.y + 24 }]);
    setSelectedId(id);
  };

  const move = (dir: 1 | -1) =>
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === selectedId);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const onBgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBgSrc(await readFileAsDataUrl(file));
    if (bgInputRef.current) bgInputRef.current.value = "";
  };

  const onPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    // Preserve the photo's real aspect ratio; fit it inside a ~320px box.
    const { w, h } = await imageDims(src);
    const scale = Math.min(320 / w, 320 / h, 1);
    const width = Math.max(40, Math.round(w * scale));
    const height = Math.max(40, Math.round(h * scale));
    const id = nextId();
    setItems((p) => [
      ...p,
      {
        id, type: "image", src,
        x: (STAGE_W - width) / 2, y: (STAGE_H - height) / 2,
        width, height, rotation: 0, opacity: 1, lockRatio: true,
      },
    ]);
    setSelectedId(id);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const addText = () => {
    const id = nextId();
    setItems((p) => [
      ...p,
      {
        id, type: "text", text: "Your text", x: 60, y: STAGE_H - 150, width: 460,
        fontSize: 64, fontFamily: FONTS[0].value, fill: "#ffffff", bold: true,
        italic: false, align: "left", stroke: null, strokeWidth: 0, rotation: 0,
      },
    ]);
    setSelectedId(id);
  };

  const addBox = () => {
    const id = nextId();
    setItems((p) => [
      ...p,
      { id, type: "rect", x: 48, y: STAGE_H - 150, width: 360, height: 90, fill: "#ef4444", cornerRadius: 8, opacity: 1, rotation: 0 },
    ]);
    setSelectedId(id);
  };

  const handleSave = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    setSaving(true);
    setSelectedId(null);
    try {
      await new Promise((r) => setTimeout(r, 60));
      const uri = stage.toDataURL({ pixelRatio: EXPORT_W / STAGE_W });
      const blob = await (await fetch(uri)).blob();
      const file = new File([blob], `thumbnail-${Date.now()}.png`, { type: "image/png" });
      const { key } = await uploadApi.uploadFile(file, "test-thumbnails");
      onSave(key);
    } finally {
      setSaving(false);
    }
  };

  const setRef = (id: string) => (node: Konva.Node | null) => {
    nodeRefs.current[id] = node;
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={onBgFile} />
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
        <Button size="sm" variant="outline" onClick={() => bgInputRef.current?.click()} title="Set a background image (cover-fits the canvas)">
          <ImageIcon className="mr-1 h-3.5 w-3.5" /> Background
        </Button>
        <Button size="sm" variant="outline" onClick={() => photoInputRef.current?.click()} title="Add a photo you can move, resize and rotate">
          <Plus className="mr-1 h-3.5 w-3.5" /> Photo
        </Button>
        <Button size="sm" variant="outline" onClick={addText} title="Add a text headline">
          <TypeIcon className="mr-1 h-3.5 w-3.5" /> Text
        </Button>
        <Button size="sm" variant="outline" onClick={addBox} title="Add a coloured box to sit behind text (highlight bar)">
          <Square className="mr-1 h-3.5 w-3.5 fill-current" /> Color box
        </Button>
        <ColorField label="Canvas" value={bgColor} onChange={setBgColor} title="Background colour (shown where no image covers)" />
      </div>

      {/* Canvas */}
      <div className="overflow-hidden rounded-md border bg-muted/30" style={{ width: STAGE_W }}>
        <Stage
          ref={stageRef}
          width={STAGE_W}
          height={STAGE_H}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) setSelectedId(null);
          }}
        >
          <Layer>
            <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill={bgColor} listening={false} />
            {bgSrc && <BackgroundImage src={bgSrc} />}
            {items.map((item) => {
              if (item.type === "image")
                return (
                  <EditableImage
                    key={item.id}
                    item={item}
                    onRef={setRef(item.id)}
                    onChange={(patch) => patchItem(item.id, patch)}
                    onSelect={() => setSelectedId(item.id)}
                    onReady={handleImageReady}
                  />
                );
              if (item.type === "rect")
                return (
                  <Rect
                    key={item.id}
                    ref={setRef(item.id)}
                    x={item.x}
                    y={item.y}
                    width={item.width}
                    height={item.height}
                    fill={item.fill}
                    cornerRadius={item.cornerRadius}
                    opacity={item.opacity}
                    rotation={item.rotation}
                    draggable
                    onClick={() => setSelectedId(item.id)}
                    onTap={() => setSelectedId(item.id)}
                    onDragEnd={(e) => patchItem(item.id, { x: e.target.x(), y: e.target.y() })}
                    onTransformEnd={(e) => {
                      const node = e.target as Konva.Rect;
                      const sx = node.scaleX();
                      const sy = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      patchItem(item.id, {
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(10, node.width() * sx),
                        height: Math.max(10, node.height() * sy),
                        rotation: node.rotation(),
                      });
                    }}
                  />
                );
              const fontStyle = `${item.bold ? "bold" : ""} ${item.italic ? "italic" : ""}`.trim() || "normal";
              return (
                <Text
                  key={item.id}
                  ref={setRef(item.id)}
                  text={item.text}
                  x={item.x}
                  y={item.y}
                  width={item.width}
                  fontSize={item.fontSize}
                  fill={item.fill}
                  fontStyle={fontStyle}
                  fontFamily={item.fontFamily}
                  align={item.align}
                  stroke={item.stroke ?? undefined}
                  strokeWidth={item.strokeWidth}
                  fillAfterStrokeEnabled
                  rotation={item.rotation}
                  draggable
                  onClick={() => setSelectedId(item.id)}
                  onTap={() => setSelectedId(item.id)}
                  onDragEnd={(e) => patchItem(item.id, { x: e.target.x(), y: e.target.y() })}
                  onTransformEnd={(e) => {
                    const node = e.target as Konva.Text;
                    const sx = node.scaleX();
                    node.scaleX(1);
                    node.scaleY(1);
                    patchItem(item.id, {
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(40, node.width() * sx),
                      rotation: node.rotation(),
                    });
                  }}
                />
              );
            })}
            <Transformer
              ref={trRef}
              rotateEnabled
              // Photos keep their aspect ratio when their lock is on; text and
              // boxes can always be stretched freely.
              keepRatio={selected?.type === "image" ? selected.lockRatio : false}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      </div>

      {/* Selected-item controls */}
      {selected ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
          {selected.type === "text" && (
            <>
              <Input
                value={selected.text}
                onChange={(e) => patchItem(selected.id, { text: e.target.value })}
                className="h-8 w-44 text-sm"
                placeholder="Text"
              />
              <select
                value={selected.fontFamily}
                onChange={(e) => patchItem(selected.id, { fontFamily: e.target.value })}
                className="h-8 rounded-md border bg-background px-2 text-sm"
                title="Font"
              >
                {FONTS.map((f) => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
              <Input
                type="number"
                min={12}
                max={240}
                value={selected.fontSize}
                onChange={(e) => patchItem(selected.id, { fontSize: Number(e.target.value) || 12 })}
                className="h-8 w-16 text-sm"
                title="Font size"
              />
              <Button size="sm" variant={selected.bold ? "default" : "outline"} onClick={() => patchItem(selected.id, { bold: !selected.bold })} title="Bold">
                <Bold className="h-4 w-4" />
              </Button>
              <Button size="sm" variant={selected.italic ? "default" : "outline"} onClick={() => patchItem(selected.id, { italic: !selected.italic })} title="Italic">
                <Italic className="h-4 w-4" />
              </Button>
              <div className="flex">
                <Button size="sm" variant={selected.align === "left" ? "default" : "outline"} className="rounded-r-none" onClick={() => patchItem(selected.id, { align: "left" })} title="Align left">
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant={selected.align === "center" ? "default" : "outline"} className="rounded-none border-x-0" onClick={() => patchItem(selected.id, { align: "center" })} title="Align center">
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button size="sm" variant={selected.align === "right" ? "default" : "outline"} className="rounded-l-none" onClick={() => patchItem(selected.id, { align: "right" })} title="Align right">
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>
              <ColorField label="Text" value={selected.fill} onChange={(v) => patchItem(selected.id, { fill: v })} />
              <Button
                size="sm"
                variant={selected.strokeWidth > 0 ? "default" : "outline"}
                onClick={() =>
                  patchItem(selected.id, selected.strokeWidth > 0
                    ? { strokeWidth: 0 }
                    : { strokeWidth: 6, stroke: selected.stroke ?? "#000000" })
                }
                title="Outline the text (improves legibility on busy backgrounds)"
              >
                Outline
              </Button>
              {selected.strokeWidth > 0 && (
                <ColorField label="" value={selected.stroke ?? "#000000"} onChange={(v) => patchItem(selected.id, { stroke: v })} title="Outline colour" />
              )}
            </>
          )}
          {selected.type === "rect" && (
            <>
              <ColorField label="Fill" value={selected.fill} onChange={(v) => patchItem(selected.id, { fill: v })} />
              <Button size="sm" variant={selected.cornerRadius > 0 ? "default" : "outline"} onClick={() => patchItem(selected.id, { cornerRadius: selected.cornerRadius > 0 ? 0 : 12 })} title="Rounded corners">
                Rounded
              </Button>
              <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Opacity">
                Opacity
                <input type="range" min={20} max={100} value={Math.round(selected.opacity * 100)} onChange={(e) => patchItem(selected.id, { opacity: Number(e.target.value) / 100 })} className="w-24" />
              </label>
            </>
          )}
          {selected.type === "image" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => removeBg(selected)}
                disabled={bgRemovingId === selected.id}
                title="Cut out the subject by removing the photo's background. Runs in your browser, first use downloads a model, so give it a few seconds."
              >
                {bgRemovingId === selected.id ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    {bgProgress >= 100
                      ? "Processing…"
                      : "Downloading model (one-time)…"}
                  </>
                ) : (
                  <>
                    <Eraser className="mr-1 h-4 w-4" />
                    Remove background
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant={selected.lockRatio ? "default" : "outline"}
                onClick={() => patchItem(selected.id, { lockRatio: !selected.lockRatio })}
                title={
                  selected.lockRatio
                    ? "Aspect ratio locked, corner-resize keeps the photo's proportions. Click to allow free stretching."
                    : "Free resize, the photo can be stretched. Click to lock the aspect ratio."
                }
              >
                {selected.lockRatio ? (
                  <Lock className="mr-1 h-4 w-4" />
                ) : (
                  <Unlock className="mr-1 h-4 w-4" />
                )}
                {selected.lockRatio ? "Ratio locked" : "Free resize"}
              </Button>
              <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Opacity">
                Opacity
                <input type="range" min={20} max={100} value={Math.round(selected.opacity * 100)} onChange={(e) => patchItem(selected.id, { opacity: Number(e.target.value) / 100 })} className="w-24" />
              </label>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={duplicateSelected} title="Duplicate">
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => move(-1)} title="Send backward">
              Back
            </Button>
            <Button size="sm" variant="outline" onClick={() => move(1)} title="Bring forward">
              Front
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={removeSelected} title="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Tip: add a <b>Color box</b> as a highlight bar, drop <b>Text</b> on top, then select the box and press
          <b> Back</b> so the text sits in front. Click any item to edit it.
        </p>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Use this thumbnail
        </Button>
      </div>
    </div>
  );
}
