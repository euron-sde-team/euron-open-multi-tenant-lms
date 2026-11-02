"use client";

import {
  cn,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@open-mtlms/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useCallback, useState } from "react";

import { ResizableImage } from "./resizable-image";
import "./lesson-rich-editor.css";

interface LessonRichEditorProps {
  /** Initial HTML content */
  content: string;
  onChange: (html: string) => void;
  /**
   * Upload an image file to S3 (presigned lecture resource flow) and return
   * the public URL. Image button is hidden when not provided. The returned
   * S3 URL is inserted into the document, never base64.
   */
  onUploadImage?: (file: File) => Promise<string | null>;
  placeholder?: string;
  className?: string;
}

export function LessonRichEditor({
  content,
  onChange,
  onUploadImage,
  placeholder = "Write the resource content here...",
  className,
}: LessonRichEditorProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    // TipTap v3 skips re-rendering on transactions by default, toolbar
    // active states and the code block hint below need live state.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit,
      Underline,
      ResizableImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const handleImageUpload = useCallback(() => {
    if (!onUploadImage) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      setUploadingImage(true);
      try {
        const url = await onUploadImage(file);
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      } finally {
        setUploadingImage(false);
      }
    };
    input.click();
  }, [editor, onUploadImage]);

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href || "";
    setLinkUrl(previousUrl);
    setLinkDialogOpen(true);
  }, [editor]);

  const handleLinkSubmit = useCallback(() => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkDialogOpen(false);
      setLinkUrl("");
      return;
    }
    // Code blocks cannot hold link marks: TipTap would silently drop the
    // link and leave the URL as code text. Step out of the block first.
    if (editor.isActive("codeBlock")) {
      editor.chain().focus().exitCode().run();
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected, setLink would be a silent no-op. Insert the URL
      // itself as a clickable link instead (JSON content, no HTML injection).
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: "text",
            text: url,
            marks: [{ type: "link", attrs: { href: url } }],
          },
          { type: "text", text: " " },
        ])
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkDialogOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  if (!editor) return null;

  return (
    <>
      <div className={cn("lesson-rich-editor rounded-lg border", className)}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Ordered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            title="Code Block"
          >
            <Code2 className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton onClick={openLinkDialog} active={editor.isActive("link")} title="Link">
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          {onUploadImage && (
            <ToolbarButton
              onClick={handleImageUpload}
              disabled={uploadingImage}
              title="Image"
            >
              {uploadingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </ToolbarButton>
          )}

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Editor */}
        <EditorContent editor={editor} className="min-h-[240px]" />
        {editor.isActive("codeBlock") && (
          <div className="border-t bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
            You are typing inside a code block. Click the code button again (or
            press Enter three times) to exit and continue with normal text.
          </div>
        )}
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <Input
            type="url"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLinkSubmit()}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            {editor.isActive("link") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setLinkDialogOpen(false);
                }}
              >
                Remove Link
              </Button>
            )}
            <Button size="sm" onClick={handleLinkSubmit}>
              {linkUrl.trim() ? "Apply" : "Remove Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded p-1.5 transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-primary/10 text-primary"
      )}
    >
      {children}
    </button>
  );
}

export default LessonRichEditor;
