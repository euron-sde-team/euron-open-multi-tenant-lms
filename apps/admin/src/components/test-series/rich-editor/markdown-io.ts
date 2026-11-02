/**
 * Markdown ⇄ Tiptap doc converters.
 *
 * The student-side renderer already parses Markdown via react-markdown +
 * remark-math + remark-gfm, so we save Tiptap content as Markdown with
 * `$...$` (inline) and `$$...$$` (block) for math. This keeps existing
 * AI-generated questions (which were saved as plain LaTeX strings)
 * compatible: they parse cleanly and the student-side renders them as it
 * always has.
 *
 * The converters are intentionally minimal, just the subset Tiptap actually
 * emits via the editor toolbar (paragraphs, headings, lists, bold/italic/code,
 * inline + block math, hard breaks).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JSONNode = any;

/* ────────────────────────────────────────────────────────────────────────── */
/* Tiptap doc → Markdown                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export function docToMarkdown(doc: JSONNode | null | undefined): string {
  if (!doc?.content) return "";
  const blocks: string[] = [];
  for (const node of doc.content) {
    const out = blockToMarkdown(node).trim();
    if (out) blocks.push(out);
  }
  return blocks.join("\n\n");
}

function blockToMarkdown(node: JSONNode): string {
  switch (node.type) {
    case "paragraph":
      return inlineToMarkdown(node.content ?? []);
    case "heading": {
      const level: number = Math.min(Math.max(node.attrs?.level ?? 2, 1), 6);
      return "#".repeat(level) + " " + inlineToMarkdown(node.content ?? []);
    }
    case "bulletList":
      return (node.content ?? [])
        .map(
          (item: JSONNode) =>
            "- " + listItemBody(item).split("\n").join("\n  "),
        )
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map(
          (item: JSONNode, i: number) =>
            `${i + 1}. ` + listItemBody(item).split("\n").join("\n   "),
        )
        .join("\n");
    case "mathBlock":
      return "$$\n" + (node.attrs?.latex ?? "") + "\n$$";
    case "codeBlock": {
      const text = (node.content ?? [])
        .map((c: JSONNode) => c.text ?? "")
        .join("");
      return "```\n" + text + "\n```";
    }
    case "blockquote":
      return (node.content ?? [])
        .map((c: JSONNode) => "> " + blockToMarkdown(c))
        .join("\n");
    case "horizontalRule":
      return "---";
    default:
      return "";
  }
}

function listItemBody(node: JSONNode): string {
  return (node.content ?? [])
    .map((c: JSONNode) => blockToMarkdown(c))
    .join("\n");
}

function inlineToMarkdown(nodes: JSONNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      if (n.type === "mathInline") return `$${n.attrs?.latex ?? ""}$`;
      if (n.type !== "text") return "";
      let t: string = n.text ?? "";
      const marks = (n.marks ?? []).map((m: JSONNode) => m.type as string);
      // Order matters: code first (no nested formatting), then bold, italic.
      if (marks.includes("code")) return "`" + t + "`";
      if (marks.includes("bold")) t = `**${t}**`;
      if (marks.includes("italic")) t = `*${t}*`;
      if (marks.includes("underline")) t = `<u>${t}</u>`;
      // Link wraps outermost so its display text keeps any inner formatting.
      const linkMark = (n.marks ?? []).find(
        (m: JSONNode) => m.type === "link",
      );
      if (linkMark?.attrs?.href) t = `[${t}](${linkMark.attrs.href})`;
      return t;
    })
    .join("");
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Markdown → Tiptap doc                                                       */
/* ────────────────────────────────────────────────────────────────────────── */
/* Minimal parser: handles paragraphs, headings, bullet/numbered lists, fenced
 * `$$...$$` math blocks, and inline `$...$` math + **bold**, *italic*, `code`.
 * Anything more exotic falls through as plain text. Good enough to round-trip
 * what the editor produces, and to load existing AI-generated content.
 */

export function markdownToDoc(md: string | null | undefined): JSONNode {
  const text = md ?? "";
  if (!text.trim()) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  // Split into block-level chunks. Treat double-newline as paragraph break,
  // but keep $$ blocks together by pre-extracting them.
  const blocks = splitBlocks(text);
  const content: JSONNode[] = blocks.map(parseBlock).filter(Boolean) as JSONNode[];
  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

function splitBlocks(input: string): string[] {
  const out: string[] = [];
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  let buf: string[] = [];

  const flush = () => {
    const joined = buf.join("\n").replace(/\n+$/, "");
    if (joined.trim()) out.push(joined);
    buf = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced math block: $$ on its own line opens, $$ on its own closes.
    if (line.trim() === "$$") {
      flush();
      const start = i + 1;
      let end = start;
      while (end < lines.length && lines[end].trim() !== "$$") end++;
      out.push("$$\n" + lines.slice(start, end).join("\n") + "\n$$");
      i = end + 1;
      continue;
    }
    if (line.trim() === "") {
      flush();
      i++;
      continue;
    }
    buf.push(line);
    i++;
  }
  flush();
  return out;
}

function parseBlock(block: string): JSONNode | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Display math
  const blockMath = trimmed.match(/^\$\$\s*([\s\S]*?)\s*\$\$$/);
  if (blockMath) {
    return { type: "mathBlock", attrs: { latex: blockMath[1] } };
  }

  // Heading
  const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    return {
      type: "heading",
      attrs: { level: heading[1].length },
      content: parseInline(heading[2]),
    };
  }

  // Bullet list (every line starts with "- " or "* ")
  const lines = trimmed.split("\n");
  if (lines.every((l) => /^[-*]\s+/.test(l))) {
    return {
      type: "bulletList",
      content: lines.map((l) => ({
        type: "listItem",
        content: [
          { type: "paragraph", content: parseInline(l.replace(/^[-*]\s+/, "")) },
        ],
      })),
    };
  }

  // Ordered list (every line starts with "N. ")
  if (lines.every((l) => /^\d+\.\s+/.test(l))) {
    return {
      type: "orderedList",
      content: lines.map((l) => ({
        type: "listItem",
        content: [
          { type: "paragraph", content: parseInline(l.replace(/^\d+\.\s+/, "")) },
        ],
      })),
    };
  }

  // Default: paragraph (allow soft line breaks via hardBreak)
  return { type: "paragraph", content: parseInline(trimmed) };
}

function parseInline(text: string): JSONNode[] {
  const result: JSONNode[] = [];
  let buf = "";
  const flushText = () => {
    if (buf) {
      // Apply mark parsing on the buffered text.
      result.push(...parseMarks(buf));
      buf = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    if (text[i] === "$" && text[i + 1] !== "$") {
      const close = text.indexOf("$", i + 1);
      if (close > -1) {
        flushText();
        result.push({
          type: "mathInline",
          attrs: { latex: text.slice(i + 1, close) },
        });
        i = close + 1;
        continue;
      }
    }
    if (text.startsWith("$$", i)) {
      const close = text.indexOf("$$", i + 2);
      if (close > -1) {
        flushText();
        // Inline-emitted $$..$$, fall back to mathInline since we're in
        // paragraph context (block math is handled at the block level).
        result.push({
          type: "mathInline",
          attrs: { latex: text.slice(i + 2, close) },
        });
        i = close + 2;
        continue;
      }
    }
    if (text[i] === "\n") {
      flushText();
      result.push({ type: "hardBreak" });
      i += 1;
      continue;
    }
    buf += text[i];
    i++;
  }
  flushText();
  return result;
}

/** Tokenise a buffer into text nodes with bold/italic/code marks. */
function parseMarks(input: string): JSONNode[] {
  const result: JSONNode[] = [];
  let i = 0;
  while (i < input.length) {
    // Inline code
    if (input[i] === "`") {
      const close = input.indexOf("`", i + 1);
      if (close > -1) {
        result.push({
          type: "text",
          text: input.slice(i + 1, close),
          marks: [{ type: "code" }],
        });
        i = close + 1;
        continue;
      }
    }
    // Bold (** … **)
    if (input.startsWith("**", i)) {
      const close = input.indexOf("**", i + 2);
      if (close > -1) {
        result.push({
          type: "text",
          text: input.slice(i + 2, close),
          marks: [{ type: "bold" }],
        });
        i = close + 2;
        continue;
      }
    }
    // Italic (*…*), single asterisk, not part of `**`
    if (input[i] === "*" && input[i + 1] !== "*") {
      const close = input.indexOf("*", i + 1);
      if (close > -1 && input[close + 1] !== "*") {
        result.push({
          type: "text",
          text: input.slice(i + 1, close),
          marks: [{ type: "italic" }],
        });
        i = close + 1;
        continue;
      }
    }
    // Link [text](url)
    if (input[i] === "[") {
      const closeBracket = input.indexOf("]", i + 1);
      if (closeBracket > -1 && input[closeBracket + 1] === "(") {
        const closeParen = input.indexOf(")", closeBracket + 2);
        if (closeParen > -1) {
          const linkText = input.slice(i + 1, closeBracket);
          const href = input.slice(closeBracket + 2, closeParen);
          result.push({
            type: "text",
            text: linkText,
            marks: [{ type: "link", attrs: { href } }],
          });
          i = closeParen + 1;
          continue;
        }
      }
    }
    // Plain run until next special token
    const next = nextSpecial(input, i + 1);
    result.push({ type: "text", text: input.slice(i, next) });
    i = next;
  }
  return result.filter((n) => !(n.type === "text" && n.text === ""));
}

function nextSpecial(s: string, from: number): number {
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (c === "`" || c === "*" || c === "[") return i;
  }
  return s.length;
}
