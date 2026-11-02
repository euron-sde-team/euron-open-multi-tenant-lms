"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@open-mtlms/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Sigma,
  SquareRadical,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { MathEquationDialog } from "./MathEquationDialog";
import { MathBlock, MathInline } from "./MathNodes";
import { docToMarkdown, markdownToDoc } from "./markdown-io";

import "katex/dist/katex.min.css";

interface RichEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Compact mode for short fields like answer options: removes headings,
   *  lists, blockquote, and display-equation. Keeps bold/italic/underline +
   *  inline equation. */
  slim?: boolean;
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
  slim = false,
}: RichEditorProps) {
  const [equationDialog, setEquationDialog] = useState<
    { displayMode: boolean } | null
  >(null);
  const [linkDialog, setLinkDialog] = useState<
    { url: string; text: string } | null
  >(null);
  // Track the last value we *emitted* so that round-tripped value props
  // (parent re-renders with the same markdown we just produced) don't trash
  // editor state. Editor is the source of truth while focused.
  const lastEmitted = useRef<string>(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable extensions we don't want exposed via toolbar to keep the
        // surface small and predictable for non-technical users.
        horizontalRule: false,
        codeBlock: false,
        strike: false,
        // StarterKit (v3) bundles Link, configure it here so our settings
        // apply (a second Link extension would just duplicate it). Links open
        // in a new tab; click-to-follow is off so authors can edit them.
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          },
        },
      }),
      Underline,
      MathInline,
      MathBlock,
      Placeholder.configure({
        placeholder: placeholder ?? "Type here…",
      }),
    ],
    content: markdownToDoc(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none",
          "[&_p]:my-1 [&_h2]:mt-3 [&_h3]:mt-2",
          "min-h-[var(--rich-editor-min)] px-3 py-2",
        ),
        style: `--rich-editor-min: ${minHeight}px`,
      },
    },
    onUpdate({ editor }) {
      const md = docToMarkdown(editor.getJSON());
      lastEmitted.current = md;
      onChange(md);
    },
  });

  // External value changes (e.g. resetting form when switching question) →
  // reload doc. We only refresh if the parent's value is something we did
  // NOT just emit, otherwise the editor would reset on every keystroke.
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    const next = markdownToDoc(value);
    editor.commands.setContent(next, { emitUpdate: false });
    lastEmitted.current = value;
  }, [value, editor]);

  const insertMath = useCallback(
    (latex: string, displayMode: boolean) => {
      if (!editor || !latex.trim()) return;
      const type = displayMode ? "mathBlock" : "mathInline";
      editor.chain().focus().insertContent({
        type,
        attrs: { latex },
      }).run();
    },
    [editor],
  );

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    const existingHref = editor.getAttributes("link")?.href as
      | string
      | undefined;
    setLinkDialog({ url: existingHref ?? "", text: selectedText });
  }, [editor]);

  const applyLink = useCallback(
    (url: string, text: string) => {
      if (!editor) return;
      const href = url.trim();
      const { from, to } = editor.state.selection;
      const hasSelection = to > from;
      // Empty URL: remove the link if the cursor sits on one, else no-op.
      if (!href) {
        if (editor.isActive("link")) {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
        }
        setLinkDialog(null);
        return;
      }
      const selectedText = hasSelection
        ? editor.state.doc.textBetween(from, to, " ")
        : "";
      if (hasSelection && (!text.trim() || text === selectedText)) {
        // Turn the current selection into a link (keeps its formatting).
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      } else {
        // Insert the display text as a link; unset the mark afterwards so
        // typing that follows isn't part of the link.
        const label = text.trim() || href;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text: label,
            marks: [{ type: "link", attrs: { href } }],
          })
          .unsetMark("link")
          .run();
      }
      setLinkDialog(null);
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className="bg-background overflow-hidden rounded-md border">
      {/* Toolbar */}
      <div className="bg-muted/30 flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={openLinkDialog}
          title="Insert link (e.g. a Google Drive dataset)"
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        {!slim && (
          <>
            <div className="bg-border mx-1 h-5 w-px" />

            <ToolbarButton
              active={editor.isActive("heading", { level: 2 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              title="Heading 2"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive("heading", { level: 3 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              title="Heading 3"
            >
              <Heading3 className="h-3.5 w-3.5" />
            </ToolbarButton>

            <div className="bg-border mx-1 h-5 w-px" />

            <ToolbarButton
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet list"
            >
              <List className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Numbered list"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Quote"
            >
              <Quote className="h-3.5 w-3.5" />
            </ToolbarButton>
          </>
        )}

        <div className="bg-border mx-1 h-5 w-px" />

        <ToolbarButton
          onClick={() => setEquationDialog({ displayMode: false })}
          title="Insert inline equation (e.g. πr²)"
        >
          <SquareRadical className="h-3.5 w-3.5" />
          <span className="ml-1 text-[11px]">Equation</span>
        </ToolbarButton>
        {!slim && (
          <ToolbarButton
            onClick={() => setEquationDialog({ displayMode: true })}
            title="Insert display equation (centered, on its own line)"
          >
            <Sigma className="h-3.5 w-3.5" />
            <span className="ml-1 text-[11px]">Display</span>
          </ToolbarButton>
        )}
      </div>

      <EditorContent editor={editor} />

      {equationDialog && (
        <MathEquationDialog
          open
          initialLatex=""
          displayMode={equationDialog.displayMode}
          onCancel={() => setEquationDialog(null)}
          onConfirm={(latex) => {
            insertMath(latex, equationDialog.displayMode);
            setEquationDialog(null);
          }}
        />
      )}

      {linkDialog && (
        <LinkDialog
          initialUrl={linkDialog.url}
          initialText={linkDialog.text}
          onCancel={() => setLinkDialog(null)}
          onConfirm={applyLink}
        />
      )}
    </div>
  );
}

function LinkDialog({
  initialUrl,
  initialText,
  onCancel,
  onConfirm,
}: {
  initialUrl: string;
  initialText: string;
  onCancel: () => void;
  onConfirm: (url: string, text: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const canInsert = url.trim().length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert link</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && canInsert) {
                  e.preventDefault();
                  onConfirm(url, text);
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="link-text">Display text</Label>
            <Input
              id="link-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Download dataset"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canInsert) {
                  e.preventDefault();
                  onConfirm(url, text);
                }
              }}
            />
            <p className="text-muted-foreground text-xs">
              Only this text shows; it links to the URL and opens in a new tab.
              Leave empty to show the URL. Clear the URL to remove an existing
              link.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(url, text)}>
            {canInsert ? "Insert" : "Remove link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "ghost"}
      onClick={onClick}
      title={title}
      className="h-7 min-w-7 px-2"
    >
      {children}
    </Button>
  );
}
