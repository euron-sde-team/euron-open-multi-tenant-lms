"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import {
  Code2,
  Copy,
  ExternalLink,
  Globe,
  History,
  ImagePlus,
  Images,
  Info,
  LayoutTemplate,
  Link2,
  Loader2,
  Monitor,
  Plus,
  Rocket,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { uploadApi } from "@/lib/api/upload";
import { canUseCustomCode } from "@/lib/data/page-categories";
import {
  usePage,
  usePageRevisions,
  useRestoreRevision,
  useSavePage,
  useTogglePublish,
} from "@/lib/hooks/use-pages";
import { useTenantWebUrl } from "@/lib/hooks/use-tenant-domain-url";
import type { SEOConfig } from "@open-mtlms/shared";

import type { CustomCodeKind, CustomPageImage } from "@/lib/types/page";

// Monaco loads client-side only (no SSR). Reuses the same editor as code-judge.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
      Loading editor…
    </div>
  ),
});


const STARTER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your Academy: Learn in-demand skills</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root { --brand:#6d28d9; --brand-2:#db2777; --ink:#0b1020; --muted:#667085; --line:#ececf3; --soft:#f7f7fb; }
      * { margin:0; padding:0; box-sizing:border-box; }
      html { scroll-behavior:smooth; }
      body { font-family:"Plus Jakarta Sans", system-ui, sans-serif; color:var(--ink); line-height:1.6; -webkit-font-smoothing:antialiased; }
      img { display:block; max-width:100%; }
      a { color:inherit; text-decoration:none; }
      .wrap { max-width:1140px; margin:0 auto; padding:0 22px; }
      .btn { display:inline-flex; align-items:center; gap:8px; padding:12px 22px; border-radius:12px; font-weight:700; transition:transform .16s; }
      .btn:hover { transform:translateY(-2px); }
      .btn-primary { background:linear-gradient(135deg,var(--brand),var(--brand-2)); color:#fff; box-shadow:0 14px 30px -12px rgba(109,40,217,.6); }
      .btn-ghost { border:1px solid var(--line); background:#fff; }
      .btn-light { background:#fff; color:var(--brand); }
      header { position:sticky; top:0; z-index:50; background:rgba(255,255,255,.85); backdrop-filter:blur(12px); border-bottom:1px solid var(--line); }
      .nav { display:flex; align-items:center; justify-content:space-between; height:70px; }
      .logo { display:flex; align-items:center; gap:10px; font-weight:800; font-size:1.15rem; }
      .logo .mark { width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,var(--brand),var(--brand-2)); display:grid; place-items:center; color:#fff; }
      .menu { display:flex; gap:28px; }
      .menu a { color:var(--muted); font-weight:600; font-size:.95rem; }
      .menu a:hover { color:var(--ink); }
      .nav-cta { display:flex; gap:10px; align-items:center; }
      .burger { display:none; background:none; border:0; font-size:1.5rem; cursor:pointer; }
      .hero { padding:88px 0 76px; background:radial-gradient(600px 320px at 15% 0%, rgba(109,40,217,.10), transparent 60%), radial-gradient(560px 300px at 90% 10%, rgba(219,39,119,.10), transparent 60%); }
      .hero-grid { display:grid; grid-template-columns:1.05fr .95fr; gap:52px; align-items:center; }
      .pill { display:inline-flex; gap:8px; background:#fff; border:1px solid var(--line); border-radius:999px; padding:7px 14px; font-weight:600; font-size:.82rem; box-shadow:0 6px 18px -12px rgba(24,16,64,.4); }
      .hero h1 { font-size:3.2rem; line-height:1.07; letter-spacing:-.025em; margin:18px 0; }
      .hero h1 .grad { background:linear-gradient(135deg,var(--brand),var(--brand-2)); -webkit-background-clip:text; background-clip:text; color:transparent; }
      .hero p.lead { font-size:1.15rem; color:var(--muted); max-width:34ch; margin-bottom:26px; }
      .hero-cta { display:flex; gap:12px; flex-wrap:wrap; }
      .hero-visual img { border-radius:22px; box-shadow:0 30px 60px -24px rgba(24,16,64,.4); width:100%; aspect-ratio:4/3.3; object-fit:cover; }
      section.block { padding:80px 0; }
      .soft { background:var(--soft); }
      .head { max-width:620px; margin:0 auto 44px; text-align:center; }
      .eyebrow { text-transform:uppercase; letter-spacing:.14em; font-size:.74rem; font-weight:700; color:var(--brand); }
      .head h2 { font-size:2.1rem; letter-spacing:-.02em; margin:10px 0; }
      .head p { color:var(--muted); }
      .courses { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
      .course { background:#fff; border:1px solid var(--line); border-radius:16px; overflow:hidden; transition:transform .2s, box-shadow .2s; }
      .course:hover { transform:translateY(-6px); box-shadow:0 24px 50px -28px rgba(24,16,64,.4); }
      .course .thumb { aspect-ratio:16/9; overflow:hidden; }
      .course .thumb img { width:100%; height:100%; object-fit:cover; transition:transform .4s; }
      .course:hover .thumb img { transform:scale(1.06); }
      .course .body { padding:18px; }
      .course h3 { font-size:1.08rem; margin-bottom:6px; }
      .course .meta { color:var(--muted); font-size:.84rem; margin-bottom:12px; }
      .course .row2 { display:flex; align-items:center; justify-content:space-between; }
      .course .price { font-weight:800; }
      .course .price s { color:var(--muted); font-weight:500; font-size:.82rem; margin-left:6px; }
      .rating { color:#f59e0b; font-weight:700; font-size:.85rem; }
      .features { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
      .feature { background:#fff; border:1px solid var(--line); border-radius:16px; padding:26px; }
      .feature .ic { width:48px; height:48px; border-radius:13px; display:grid; place-items:center; font-size:1.35rem; margin-bottom:14px; background:linear-gradient(135deg,rgba(109,40,217,.12),rgba(219,39,119,.12)); }
      .feature h3 { font-size:1.08rem; margin-bottom:6px; }
      .feature p { color:var(--muted); font-size:.95rem; }
      .cta { border-radius:24px; padding:60px 40px; text-align:center; color:#fff; background:linear-gradient(135deg,var(--brand),var(--brand-2)); }
      .cta h2 { font-size:2.2rem; margin-bottom:12px; }
      .cta p { opacity:.94; margin-bottom:24px; }
      footer { background:var(--ink); color:#98a2b3; padding:56px 0 28px; }
      .foot-grid { display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr; gap:32px; margin-bottom:30px; }
      .foot-grid h4 { color:#fff; font-size:.95rem; margin-bottom:12px; }
      .foot-grid a { display:block; padding:5px 0; font-size:.92rem; color:#98a2b3; }
      .foot-grid a:hover { color:#fff; }
      .foot-logo { display:flex; align-items:center; gap:10px; color:#fff; font-weight:800; margin-bottom:12px; }
      .foot-bottom { border-top:1px solid rgba(255,255,255,.1); padding-top:18px; font-size:.85rem; }
      @media (max-width:900px) {
        .hero-grid,.courses,.features,.foot-grid { grid-template-columns:1fr; }
        .hero h1 { font-size:2.3rem; }
        .menu { display:none; } .burger { display:block; } .cta { padding:44px 24px; }
      }
    </style>
  </head>
  <body>
    <!-- ===== Header ===== -->
    <header>
      <div class="wrap nav">
        <a class="logo" href="/"><span class="mark">A</span> Your Academy</a>
        <nav class="menu" id="menu">
          <a href="/all-courses">Courses</a>
          <a href="/test-series">Test Series</a>
          <a href="/books">Books</a>
          <a href="/bundles">Bundles</a>
        </nav>
        <div class="nav-cta">
          <a class="btn btn-ghost" href="/search">Search</a>
          <a class="btn btn-primary" href="/all-courses">Get started</a>
          <button class="burger" onclick="toggleMenu()">☰</button>
        </div>
      </div>
    </header>

    <!-- ===== Hero ===== -->
    <section class="hero">
      <div class="wrap hero-grid">
        <div>
          <span class="pill">🎉 New 2026 batches are live</span>
          <h1>Master <span class="grad">in-demand skills</span> and get hired.</h1>
          <p class="lead">Live cohorts, self-paced courses and exam-grade test series, with mentors who care about your outcome.</p>
          <div class="hero-cta">
            <a class="btn btn-primary" href="/all-courses">Explore courses →</a>
            <a class="btn btn-ghost" href="/test-series">Try a free test</a>
          </div>
        </div>
        <div class="hero-visual">
          <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=760&fit=crop&q=80" alt="Students learning" />
        </div>
      </div>
    </section>

    <!-- ===== Popular courses ===== -->
    <section class="block">
      <div class="wrap">
        <div class="head"><span class="eyebrow">Most popular</span><h2>Courses learners love</h2><p>Replace these with links to your own courses.</p></div>
        <div class="courses">
          <a class="course" href="/all-courses"><div class="thumb"><img src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=640&h=360&fit=crop&q=80" alt="" /></div><div class="body"><h3>Full-Stack Web Development</h3><div class="meta">42 lessons</div><div class="row2"><span class="price">₹4,999 <s>₹9,999</s></span><span class="rating">★ 4.9</span></div></div></a>
          <a class="course" href="/all-courses"><div class="thumb"><img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=640&h=360&fit=crop&q=80" alt="" /></div><div class="body"><h3>Data Science & Analytics</h3><div class="meta">56 lessons</div><div class="row2"><span class="price">₹5,499 <s>₹11,999</s></span><span class="rating">★ 4.8</span></div></div></a>
          <a class="course" href="/all-courses"><div class="thumb"><img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=640&h=360&fit=crop&q=80" alt="" /></div><div class="body"><h3>UI/UX Design Masterclass</h3><div class="meta">38 lessons</div><div class="row2"><span class="price">₹3,999 <s>₹7,999</s></span><span class="rating">★ 4.9</span></div></div></a>
        </div>
        <div style="text-align:center; margin-top:34px"><a class="btn btn-ghost" href="/all-courses">View all courses →</a></div>
      </div>
    </section>

    <!-- ===== Features ===== -->
    <section class="block soft">
      <div class="wrap">
        <div class="head"><span class="eyebrow">Why us</span><h2>Built for real outcomes</h2></div>
        <div class="features">
          <div class="feature"><div class="ic">🟢</div><h3>Learn at your pace</h3><p>Self-paced courses you can pick up any time, on any device.</p></div>
          <div class="feature"><div class="ic">📝</div><h3>Exam-grade tests</h3><p>Realistic test series with analytics to track your progress.</p></div>
          <div class="feature"><div class="ic">🎯</div><h3>Mentor support</h3><p>1:1 guidance and reviews from industry practitioners.</p></div>
        </div>
      </div>
    </section>

    <!-- ===== CTA ===== -->
    <section class="block">
      <div class="wrap"><div class="cta"><h2>Start learning today</h2><p>Join thousands building real, job-ready skills.</p><a class="btn btn-light" href="/all-courses">Browse all courses →</a></div></div>
    </section>

    <!-- ===== Footer ===== -->
    <footer>
      <div class="wrap">
        <div class="foot-grid">
          <div><div class="foot-logo"><span class="mark" style="width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:linear-gradient(135deg,var(--brand),var(--brand-2))">A</span> Your Academy</div><p style="max-width:34ch">Master in-demand skills with expert-led courses and mentors.</p></div>
          <div><h4>Learn</h4><a href="/all-courses">All courses</a><a href="/self-paced">Self-paced</a><a href="/test-series">Test series</a></div>
          <div><h4>Explore</h4><a href="/books">Books</a><a href="/bundles">Bundles</a><a href="/categories">Categories</a></div>
          <div><h4>Account</h4><a href="/my-learning">My learning</a><a href="/cart">Cart</a><a href="/search">Search</a><a href="/profile">Profile</a></div>
        </div>
        <div class="foot-bottom">© 2026 Your Academy. All rights reserved.</div>
      </div>
    </footer>

    <script>
      // Mobile menu toggle. Tip: use the device buttons above the preview to
      // check how your page looks on tablet and mobile.
      function toggleMenu() {
        var m = document.getElementById("menu");
        var open = m.style.display === "flex";
        m.style.cssText = open ? "" : "display:flex;flex-direction:column;gap:14px;position:absolute;top:70px;left:0;right:0;background:#fff;padding:18px 22px;border-bottom:1px solid var(--line)";
      }
    </script>
  </body>
</html>
`;

/**
 * Preview sandbox: MUST match the production renderer (apps/web
 * custom-code-page.tsx): allow-scripts for JS mode, never allow-same-origin.
 */
function previewSandbox(kind: CustomCodeKind): string {
  return kind === "SANITIZED_INLINE"
    ? "allow-forms allow-popups allow-top-navigation-by-user-activation"
    : "allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-top-navigation-by-user-activation";
}

/**
 * Inject `<base target="_top">` so links open the storefront (not inside the
 * iframe). Mirrors the production renderer (apps/web custom-code-page.tsx) so
 * the preview behaves exactly like the live page.
 */
function withTopBase(html: string): string {
  if (/<base\b/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, '<head$1><base target="_top">');
  }
  return `<base target="_top">${html}`;
}

/** Preview device widths (height fills the panel; content scrolls inside). */
const DEVICE_WIDTHS: Record<"desktop" | "tablet" | "mobile", string> = {
  desktop: "100%",
  tablet: "820px",
  mobile: "390px",
};

/**
 * Real storefront routes a tenant can link to from a custom page. Links use the
 * page's own domain (relative paths), and the injected `<base target="_top">`
 * makes them navigate the whole site on click.
 */
const PLATFORM_LINKS: { group: string; items: { label: string; path: string }[] }[] = [
  {
    group: "Catalog",
    items: [
      { label: "All courses", path: "/all-courses" },
      { label: "Self-paced courses", path: "/self-paced" },
      { label: "Books", path: "/books" },
      { label: "Bundles", path: "/bundles" },
      { label: "Test series", path: "/test-series" },
      { label: "Categories", path: "/categories" },
    ],
  },
  {
    group: "Commerce & account",
    items: [
      { label: "Log in", path: "/login" },
      { label: "Sign up", path: "/signup" },
      { label: "Search", path: "/search" },
      { label: "Cart", path: "/cart" },
      { label: "My learning", path: "/my-learning" },
      { label: "Profile", path: "/profile" },
      { label: "Account & subscription", path: "/account/subscription" },
    ],
  },
  {
    group: "Specific item (replace the-slug)",
    items: [
      { label: "A course", path: "/courses/the-slug" },
      { label: "A book", path: "/books/the-slug" },
      { label: "A bundle", path: "/bundles/the-slug" },
      { label: "A test series", path: "/test-series/the-slug" },
      { label: "Buy a course directly", path: "/checkout/direct?type=COURSE&id=COURSE_ID" },
    ],
  },
];

/** Ready-made blocks a non-technical user can insert at the cursor. */
const SNIPPETS: { label: string; desc: string; code: string }[] = [
  {
    label: "Button (link to courses)",
    desc: "A styled call-to-action button.",
    code: `\n<a href="/all-courses" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 22px;border-radius:10px;font-weight:600;text-decoration:none;">Browse courses</a>\n`,
  },
  {
    label: "Responsive image",
    desc: "An image that scales to the screen.",
    code: `\n<img src="PASTE_IMAGE_URL" alt="" style="max-width:100%;height:auto;border-radius:12px;" />\n`,
  },
  {
    label: "Two-column section",
    desc: "Text beside an image, stacks on mobile.",
    code: `\n<section style="max-width:1100px;margin:0 auto;padding:56px 20px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;">
  <div>
    <h2 style="font-size:2rem;margin:0 0 12px;">Your headline</h2>
    <p style="color:#475569;margin:0 0 18px;">Describe what you offer here.</p>
    <a href="/all-courses" style="background:#4f46e5;color:#fff;padding:12px 22px;border-radius:10px;font-weight:600;text-decoration:none;">Learn more</a>
  </div>
  <img src="PASTE_IMAGE_URL" alt="" style="width:100%;border-radius:16px;" />
</section>\n`,
  },
  {
    label: "Call-to-action band",
    desc: "A full-width colored CTA strip.",
    code: `\n<section style="background:linear-gradient(135deg,#4f46e5,#db2777);color:#fff;text-align:center;padding:56px 20px;">
  <h2 style="font-size:2rem;margin:0 0 10px;">Start learning today</h2>
  <p style="opacity:.9;margin:0 0 20px;">Join thousands of learners.</p>
  <a href="/all-courses" style="background:#fff;color:#4f46e5;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none;">Browse courses</a>
</section>\n`,
  },
];

export default function CustomCodeEditorPage() {
  const params = useParams<{ id: string }>();
  const pageId = (params?.id ?? "") as string;
  const router = useRouter();
  const { toast } = useToast();

  const { data: page, isLoading } = usePage(pageId);
  const savePage = useSavePage();
  const togglePublish = useTogglePublish();
  const restoreRevision = useRestoreRevision();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmSwitchOpen, setConfirmSwitchOpen] = useState(false);
  // Only fetch versions while the History dialog is open.
  const { data: revisions, isLoading: revisionsLoading } = usePageRevisions(
    pageId,
    historyOpen
  );

  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [html, setHtml] = useState("");
  const [kind, setKind] = useState<CustomCodeKind>("SANDBOXED_IFRAME");
  const [previewHtml, setPreviewHtml] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [publishedOnce, setPublishedOnce] = useState(false);

  // SEO (reuses the page's existing seo JSON) + uploaded-image library.
  const [seo, setSeo] = useState<SEOConfig>({ title: "", description: "" });
  const [assets, setAssets] = useState<CustomPageImage[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);

  // Minimal Monaco editor handle for format + insert-at-cursor.
  const editorRef = useRef<{
    focus: () => void;
    getSelection: () => unknown;
    executeEdits: (source: string, edits: unknown[]) => void;
    getAction: (id: string) => { run: () => void } | null;
  } | null>(null);

  // Storefront URL for this page, so "View live page" points at the real site.
  const liveUrl = useTenantWebUrl(page?.slug ? `/${page.slug}` : "/");

  // Seed the editor once from the page's draft (fall back to published, then starter).
  useEffect(() => {
    if (page && !seeded) {
      setHtml(page.customHtmlDraft ?? page.customHtml ?? STARTER_HTML);
      setKind((page.customCodeKind as CustomCodeKind) ?? "SANDBOXED_IFRAME");
      setPreviewHtml(page.customHtmlDraft ?? page.customHtml ?? STARTER_HTML);
      setPublishedOnce(!!page.isPublished);
      setSeo({
        title: page.seo?.title ?? page.title ?? "",
        description: page.seo?.description ?? "",
        keywords: page.seo?.keywords,
        ogImage: page.seo?.ogImage,
        canonicalUrl: page.seo?.canonicalUrl,
        noIndex: page.seo?.noIndex,
      });
      setAssets(page.customAssets?.images ?? []);
      setSeeded(true);
    }
  }, [page, seeded]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const updateHtml = useCallback((value: string) => {
    setHtml(value);
    setDirty(true);
  }, []);

  // Insert a snippet at the cursor (falls back to appending).
  const insertSnippet = useCallback((snippet: string) => {
    const ed = editorRef.current;
    const sel = ed?.getSelection?.();
    if (ed && sel) {
      ed.executeEdits("lms-insert", [{ range: sel, text: snippet, forceMoveMarkers: true }]);
      ed.focus();
    } else {
      setHtml((prev) => prev + snippet);
    }
    setDirty(true);
  }, []);

  const formatCode = useCallback(() => {
    editorRef.current?.getAction?.("editor.action.formatDocument")?.run();
  }, []);

  // Discard local edits and reload the last published copy (safety net).
  const discardChanges = useCallback(() => {
    if (!page) return;
    if (!window.confirm("Discard your unsaved changes and reload the last published version?")) return;
    const base = page.customHtml ?? page.customHtmlDraft ?? "";
    setHtml(base);
    setPreviewHtml(base);
    setDirty(false);
    toast({ title: "Reverted", description: "Reloaded the last published version." });
  }, [page, toast]);

  // Restore a saved version into the editor as an unsaved draft. The server
  // writes it to custom_html_draft and returns the page; we load that HTML in
  // and mark dirty so the tenant reviews before saving/publishing.
  const onRestore = useCallback(
    (revisionId: string) => {
      if (!pageId) return;
      restoreRevision.mutate(
        { pageId, revisionId },
        {
          onSuccess: (restored) => {
            const restoredHtml =
              restored.customHtmlDraft ?? restored.customHtml ?? "";
            setHtml(restoredHtml);
            setPreviewHtml(restoredHtml);
            setDirty(true);
            setHistoryOpen(false);
            toast({
              title: "Version restored",
              description: "Loaded into the editor. Review it, then Save draft or Publish.",
            });
          },
          onError: () => {
            toast({
              title: "Restore failed",
              description: "Could not restore that version. Please try again.",
              variant: "destructive",
            });
          },
        }
      );
    },
    [pageId, restoreRevision, toast]
  );

  const onUploadImage = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const { url } = await uploadApi.uploadFile(file, `custom-pages/${pageId}`);
        setLastUploadedUrl(url);
        // Add to the page's image library and persist it right away so the
        // uploaded image is available to reuse later even without other edits.
        const nextAssets: CustomPageImage[] = [
          { url, name: file.name, uploadedAt: new Date().toISOString() },
          ...assets.filter((a) => a.url !== url),
        ];
        setAssets(nextAssets);
        // Persist only the library here (not the HTML) so a stale editor
        // closure can never overwrite the draft; HTML is saved by autosave/Save.
        savePage
          .mutateAsync({
            pageId,
            data: { customAssets: { images: nextAssets } },
          })
          .catch(() => {
            /* non-fatal; the image is still uploaded and shown in the copy bar */
          });
        let copied = false;
        try {
          await navigator.clipboard.writeText(url);
          copied = true;
        } catch {
          /* clipboard may be blocked; the URL is still shown below the toolbar */
        }
        toast({
          title: "Image uploaded ✓",
          description: copied
            ? "URL copied to your clipboard, paste it into your code, or over an existing image link to replace it."
            : "Copy the URL shown below the toolbar and paste it into your code.",
        });
      } catch (e) {
        toast({
          title: "Upload failed",
          description: e instanceof Error ? e.message : "Could not upload the image.",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [pageId, toast, assets, savePage],
  );

  // Live preview: mirror the editor into the preview a beat after typing stops
  // (debounced so we don't re-mount the iframe on every keystroke).
  useEffect(() => {
    const t = setTimeout(() => setPreviewHtml(html), 350);
    return () => clearTimeout(t);
  }, [html]);

  const bytes = useMemo(() => new Blob([html]).size, [html]);
  const overLimit = bytes > 512 * 1024;

  const saveDraft = async (assetsOverride?: CustomPageImage[]) => {
    const imgs = assetsOverride ?? assets;
    await savePage.mutateAsync({
      pageId,
      data: {
        renderMode: "CUSTOM_CODE",
        customCodeKind: kind,
        customHtmlDraft: html,
        title: seo.title?.trim() || undefined,
        seo,
        customAssets: { images: imgs },
      },
    });
  };

  // Autosave the draft a few seconds after edits stop, so work is never lost.
  useEffect(() => {
    if (!seeded || !dirty || overLimit || savePage.isPending) return;
    const t = setTimeout(() => {
      saveDraft()
        .then(() => setDirty(false))
        .catch(() => {
          /* keep dirty so the manual Save button can retry */
        });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, kind, dirty, seeded, overLimit]);

  const onSave = async () => {
    if (overLimit) {
      toast({ title: "Too large", description: "Keep the document under 512 KB.", variant: "destructive" });
      return;
    }
    try {
      await saveDraft();
      setDirty(false);
      toast({ title: "Draft saved", description: "Your changes are saved. Publish to make them live." });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const onPublish = async () => {
    if (overLimit) {
      toast({ title: "Too large", description: "Keep the document under 512 KB.", variant: "destructive" });
      return;
    }
    try {
      await saveDraft();
      await togglePublish.mutateAsync({ pageId, isPublished: true });
      setDirty(false);
      setPublishedOnce(true);
      toast({ title: "Published 🎉", description: "Your custom page is now live." });
    } catch (e) {
      toast({ title: "Publish failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  // Turn off custom code: switch the page back to the section-based template.
  // The custom HTML stays saved (draft), so it can be turned back on later.
  // Confirmation is a proper modal (below), not a browser alert.
  const doSwitchToTemplate = async () => {
    setConfirmSwitchOpen(false);
    try {
      await savePage.mutateAsync({
        pageId,
        data: { renderMode: "SECTIONS" },
      });
      toast({
        title: "Switched to template",
        description: "The template is now live for this page.",
      });
      router.push(`/dashboard/pages/${pageId}/editor`);
    } catch (e) {
      toast({
        title: "Could not switch",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Custom code is only for the fixed content pages (home, about, contact,
  // faq, privacy, terms). Guard the route in case it is opened directly for a
  // blog or system page, which the UI otherwise never links to.
  if (page && !canUseCustomCode(page.slug)) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Code2 className="text-muted-foreground h-8 w-8" />
        <p className="text-sm font-medium">
          Custom code is not available for this page.
        </p>
        <p className="text-muted-foreground max-w-md text-xs">
          It is offered only for your content pages (home, about, contact, FAQ,
          privacy and terms). Other pages stay on the platform so listings and
          links keep working.
        </p>
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Code2 className="text-primary h-4 w-4" />
            <span className="text-sm font-semibold">
              Custom code{page?.title ? `: ${page.title}` : ""}
            </span>
            {/* Fixed-width slot so the label never changes the toolbar width
                (prevents the row wrapping between one and two lines on save). */}
            <span className="text-muted-foreground flex w-[10.5rem] shrink-0 items-center gap-1 text-xs">
              {dirty ? (
                <>
                  <span className="bg-amber-500 h-1.5 w-1.5 rounded-full" /> Unsaved changes
                </>
              ) : seeded ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Saved (autosaves)
                </>
              ) : null}
            </span>
          </div>
          {publishedOnce && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View live page
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadImage(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" />
            )}
            Upload image
          </Button>
          <Select value={kind} onValueChange={(v) => { setKind(v as CustomCodeKind); setDirty(true); }}>
            <SelectTrigger className="h-8 w-[190px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SANDBOXED_IFRAME">Sandboxed (JS allowed)</SelectItem>
              <SelectItem value="SANITIZED_INLINE">Static (no JavaScript)</SelectItem>
            </SelectContent>
          </Select>
          <span className={overLimit ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
            {(bytes / 1024).toFixed(1)} KB / 512 KB
          </span>
          <span className="bg-border mx-1 h-6 w-px" aria-hidden />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmSwitchOpen(true)}
            disabled={savePage.isPending}
            className="gap-2"
            title="Turn off custom code and use the section template instead"
          >
            <LayoutTemplate className="h-4 w-4" /> Use template
          </Button>
          <Dialog open={confirmSwitchOpen} onOpenChange={setConfirmSwitchOpen}>
            <DialogContent className="w-[30rem]">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <LayoutTemplate className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">Use the template instead?</h2>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      This turns off custom code for this page. The section-based
                      template becomes live for visitors. Your custom code stays
                      saved, so you can switch back anytime.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmSwitchOpen(false)}
                    disabled={savePage.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={doSwitchToTemplate}
                    disabled={savePage.isPending}
                  >
                    {savePage.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LayoutTemplate className="mr-2 h-4 w-4" />
                    )}
                    Use template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Platform links" aria-label="Platform links">
                <Link2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] w-[32rem] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Link to your platform</h2>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Add normal links in your HTML to send visitors to real pages.
                    courses, books, bundles, test series, cart and checkout. Links
                    open the whole site (we add <code className="font-mono">target=&quot;_top&quot;</code> for you).
                    Example: <code className="font-mono text-[11px]">&lt;a href=&quot;/all-courses&quot;&gt;Browse courses&lt;/a&gt;</code>
                  </p>
                </div>
                {PLATFORM_LINKS.map((g) => (
                  <div key={g.group} className="space-y-1.5">
                    <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                      {g.group}
                    </div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {g.items.map((it) => (
                        <div
                          key={it.path}
                          className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                        >
                          <span className="text-xs">{it.label}</span>
                          <code className="text-muted-foreground font-mono text-[11px]">{it.path}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Version history" aria-label="Version history">
                <History className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] w-[34rem] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Version history</h2>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    We save a snapshot each time you publish (last 20 kept).
                    Restoring loads that version into the editor as an unsaved
                    draft, so you can review it before you Save or Publish.
                  </p>
                </div>
                {revisionsLoading ? (
                  <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading versions…
                  </div>
                ) : !revisions || revisions.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
                    No saved versions yet. Publish this page to create the first
                    snapshot.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {revisions.map((rev, i) => (
                      <div
                        key={rev.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {i === 0 ? "Latest published" : `Version ${revisions.length - i}`}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(rev.createdAt).toLocaleString()}
                            {rev.customCodeKind
                              ? ` · ${rev.customCodeKind === "SANDBOXED_IFRAME" ? "JavaScript" : "Static"}`
                              : ""}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRestore(rev.id)}
                          disabled={restoreRevision.isPending}
                        >
                          {restoreRevision.isPending &&
                          restoreRevision.variables?.revisionId === rev.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Restore"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="SEO and social" aria-label="SEO and social">
                <Globe className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] w-[34rem] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Search &amp; social</h2>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    How this page looks on Google and when shared. These do not
                    change your page design. Save the draft and publish to apply.
                  </p>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Page title</span>
                  <input
                    type="text"
                    value={seo.title}
                    onChange={(e) => {
                      setSeo((s) => ({ ...s, title: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="e.g. About X Academic Services"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Meta description</span>
                  <textarea
                    value={seo.description}
                    onChange={(e) => {
                      setSeo((s) => ({ ...s, description: e.target.value }));
                      setDirty(true);
                    }}
                    rows={3}
                    maxLength={320}
                    placeholder="A short summary shown under the title in search results."
                    className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <span className="text-muted-foreground text-[11px]">
                    {(seo.description || "").length}/320
                  </span>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Social share image URL</span>
                  <input
                    type="text"
                    value={seo.ogImage || ""}
                    onChange={(e) => {
                      setSeo((s) => ({ ...s, ogImage: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="https://… (use Upload image, then paste the URL)"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Keywords</span>
                  <input
                    type="text"
                    value={(seo.keywords || []).join(", ")}
                    onChange={(e) => {
                      const kws = e.target.value
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean);
                      setSeo((s) => ({ ...s, keywords: kws }));
                      setDirty(true);
                    }}
                    placeholder="comma, separated, keywords"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Canonical URL</span>
                  <input
                    type="text"
                    value={seo.canonicalUrl || ""}
                    onChange={(e) => {
                      setSeo((s) => ({ ...s, canonicalUrl: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="https://… (optional, for duplicate content)"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={!!seo.noIndex}
                    onChange={(e) => {
                      setSeo((s) => ({ ...s, noIndex: e.target.checked }));
                      setDirty(true);
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Hide this page from search engines</span>
                </label>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title={`Image library${assets.length ? ` (${assets.length})` : ""}`}
                aria-label="Image library"
                className="relative"
              >
                <Images className="h-4 w-4" />
                {assets.length > 0 ? (
                  <span className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none">
                    {assets.length}
                  </span>
                ) : null}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] w-[36rem] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Image library</h2>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Every image you upload for this page is saved here. Click one
                    to copy its URL, then paste it into your code.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="mr-2 h-4 w-4" />
                  )}
                  Upload image
                </Button>
                {assets.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border border-dashed px-3 py-8 text-center text-sm">
                    No images yet. Upload one to start your library.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {assets.map((img) => (
                      <div
                        key={img.url}
                        className="group relative overflow-hidden rounded-lg border"
                      >
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(img.url);
                              setLastUploadedUrl(img.url);
                              toast({
                                title: "URL copied",
                                description: "Paste it into your code.",
                              });
                            } catch {
                              setLastUploadedUrl(img.url);
                              toast({
                                title: "Copy the URL",
                                description: "Shown below the toolbar.",
                              });
                            }
                          }}
                          className="block w-full"
                          title={img.name || img.url}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.name || "Uploaded image"}
                            className="aspect-video w-full bg-muted object-cover"
                          />
                          <span className="bg-foreground/70 absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
                            Click to copy URL
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = assets.filter((a) => a.url !== img.url);
                            setAssets(next);
                            savePage
                              .mutateAsync({
                                pageId,
                                data: { customAssets: { images: next } },
                              })
                              .catch(() => {
                                /* non-fatal */
                              });
                          }}
                          aria-label="Remove from library"
                          className="bg-background/90 text-destructive absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-muted-foreground text-[11px]">
                  Removing an image here only takes it out of this library. It
                  does not delete it from pages that already use its URL.
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <span className="bg-border ml-auto mr-1 h-6 w-px" aria-hidden />
          <Button
            variant="ghost"
            size="sm"
            onClick={discardChanges}
            disabled={!dirty || savePage.isPending}
          >
            Discard
          </Button>
          <Button variant="outline" size="sm" onClick={onSave} disabled={savePage.isPending}>
            {savePage.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save draft
          </Button>
          <Button size="sm" onClick={onPublish} disabled={savePage.isPending || togglePublish.isPending}>
            {togglePublish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            Publish
          </Button>
        </div>
      </div>

      {/* Last uploaded image URL, copy and paste it into your code (or over an existing image link) */}
      {lastUploadedUrl && (
        <div className="flex items-center gap-2 border-b bg-emerald-50 px-4 py-2 text-xs dark:bg-emerald-950/30">
          <ImagePlus className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="shrink-0 font-medium text-emerald-700 dark:text-emerald-400">
            Image URL:
          </span>
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {lastUploadedUrl}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="h-6 shrink-0 px-2 text-[11px]"
            onClick={() => {
              navigator.clipboard.writeText(lastUploadedUrl).catch(() => {});
              toast({ title: "Copied", description: "Image URL copied to clipboard." });
            }}
          >
            <Copy className="mr-1 h-3 w-3" /> Copy
          </Button>
          <button
            type="button"
            onClick={() => setLastUploadedUrl(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Getting-started hint (dismissible) */}
      {showHint && (
        <div className="bg-primary/5 border-primary/10 flex items-start gap-3 border-b px-4 py-2.5 text-xs">
          <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-muted-foreground flex-1 leading-relaxed">
            <span className="text-foreground font-medium">New here?</span> Write or paste your HTML on the
            left, the right side previews it live. Use{" "}
            <span className="text-foreground font-medium">Upload image</span> to add pictures,{" "}
            <span className="text-foreground font-medium">Platform links</span> to link to your courses &amp;
            checkout, the device icons to check mobile, then{" "}
            <span className="text-foreground font-medium">Publish</span> to go live.
          </div>
          <button
            type="button"
            onClick={() => setShowHint(false)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Split: editor + live preview */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="border-border flex min-h-0 flex-col border-r">
          <div className="text-muted-foreground bg-muted/40 flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium">
            <span>HTML / CSS / JavaScript (single document)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={formatCode}
                title="Tidy up the code formatting"
                className="hover:bg-accent flex items-center gap-1 rounded px-2 py-0.5 transition-colors"
              >
                <Wand2 className="h-3.5 w-3.5" /> Format
              </button>
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    title="Insert a ready-made snippet"
                    className="hover:bg-accent flex items-center gap-1 rounded px-2 py-0.5 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Insert
                  </button>
                </DialogTrigger>
                <DialogContent className="w-[30rem]">
                  <h2 className="mb-1 text-base font-semibold">Insert a snippet</h2>
                  <p className="text-muted-foreground mb-3 text-xs">
                    Adds a ready-made block at your cursor.
                  </p>
                  <div className="grid gap-2">
                    {SNIPPETS.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => insertSnippet(s.code)}
                        className="hover:border-primary/40 rounded-md border px-3 py-2 text-left text-sm transition-colors"
                      >
                        <div className="font-medium">{s.label}</div>
                        <div className="text-muted-foreground text-xs">{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <MonacoEditor
              language="html"
              theme="vs-dark"
              value={html}
              onChange={(value) => updateHtml(value ?? "")}
              onMount={(editor) => {
                editorRef.current = editor as unknown as typeof editorRef.current;
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                tabSize: 2,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                automaticLayout: true,
                padding: { top: 10 },
              }}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="text-muted-foreground bg-muted/40 flex items-center justify-between px-3 py-1.5 text-xs font-medium">
            <span>Live preview · updates as you type</span>
            <div className="flex items-center gap-0.5">
              {(
                [
                  { id: "desktop", icon: Monitor, label: "Desktop" },
                  { id: "tablet", icon: Tablet, label: "Tablet" },
                  { id: "mobile", icon: Smartphone, label: "Mobile" },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDevice(id)}
                  title={label}
                  className={
                    "flex h-6 w-6 items-center justify-center rounded transition-colors " +
                    (device === id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent")
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
          <div
            className={
              "bg-muted/30 min-h-0 flex-1 overflow-auto " +
              (device === "desktop" ? "" : "flex justify-center p-4")
            }
          >
            <iframe
              key={String(previewHtml.length) + kind + device}
              srcDoc={withTopBase(previewHtml)}
              sandbox={previewSandbox(kind)}
              title="Custom page preview"
              style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%" }}
              className={
                "h-full border-0 bg-white " +
                (device === "desktop"
                  ? "w-full"
                  : "shrink-0 rounded-xl shadow-lg ring-1 ring-black/10")
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
