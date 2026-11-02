"use client";

import { Card, CardContent } from "@open-mtlms/core";
import {
  ArrowRight,
  Award,
  BookOpen,
  ClipboardCheck,
  FolderTree,
  Layers,
  Lightbulb,
  PenLine,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";


const cards = [
  {
    step: 1,
    href: "/dashboard/test-series/question-banks",
    title: "Question Banks",
    description:
      "Author and organize questions. Add manually or generate with AI.",
    Icon: BookOpen,
    accent: "from-sky-500/15 to-sky-500/0",
    iconClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    step: 2,
    href: "/dashboard/test-series/tests",
    title: "Tests",
    description:
      "Build tests with sections, marking schemes, and timing. Pull questions from your banks.",
    Icon: ClipboardCheck,
    accent: "from-violet-500/15 to-violet-500/0",
    iconClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    step: 3,
    href: "/dashboard/test-series/series",
    title: "Test Series",
    description:
      "Bundle tests, set pricing and visibility, and publish to your catalog.",
    Icon: Layers,
    accent: "from-emerald-500/15 to-emerald-500/0",
    iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    step: 4,
    href: "/dashboard/test-series/grading",
    title: "Grading",
    description:
      "Review and mark descriptive answers submitted by learners. Award marks and leave remarks per answer.",
    Icon: PenLine,
    accent: "from-rose-500/15 to-rose-500/0",
    iconClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
  {
    step: 5,
    href: "/dashboard/test-series/scholarships",
    title: "Scholarships",
    description:
      "Offer score-based scholarships on a test or series. Qualifying learners are auto-flagged for your approval.",
    Icon: Award,
    accent: "from-amber-500/15 to-amber-500/0",
    iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    step: 6,
    href: "/dashboard/test-series/learners",
    title: "Learners",
    description:
      "Find a learner and see every test they have taken, with their answers question by question.",
    Icon: Users,
    accent: "from-cyan-500/15 to-cyan-500/0",
    iconClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  },
  {
    step: 7,
    href: "/dashboard/test-series/taxonomy",
    title: "Question Taxonomy",
    description:
      "Define subjects, chapters and topics. Tag questions and drive per-section question blueprints.",
    Icon: FolderTree,
    accent: "from-rose-500/15 to-rose-500/0",
    iconClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
];

const guideSteps = [
  {
    title: "Build your question bank",
    body: "Create one or more banks per subject or topic. Add questions manually or use AI to generate from a PDF.",
  },
  {
    title: "Compose a test",
    body: "Pick questions from your banks into sections. Set duration, marking, and toggles like shuffle and re-attempt.",
  },
  {
    title: "Bundle into a series",
    body: "Add one or more tests to a series. Configure pricing (free or paid) and visibility (public, unlisted, private).",
  },
  {
    title: "Publish",
    body: "Click Publish on the series. It appears in your tenant's catalog and can be enrolled, attempted, and graded by learners.",
  },
];

export default function TestSeriesDashboardPage() {
  return (
    <div className="space-y-10 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Series</h1>
        <p className="text-muted-foreground mt-1">
          Author question banks, build tests, and ship paid or free test series.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ step, href, title, description, Icon, accent, iconClass }) => (
          <Link key={href} href={href} className="group">
            <Card className="hover:border-primary/40 relative h-full overflow-hidden border transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent}`}
              />
              <CardContent className="relative space-y-4 p-6">
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-lg ${iconClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-muted-foreground text-xs font-semibold">
                    Step {step}
                  </span>
                </div>
                <div>
                  <h3 className="text-foreground text-lg font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {description}
                  </p>
                </div>
                <div className="text-primary inline-flex items-center text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
                  Open
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-md">
              <Lightbulb className="h-4 w-4" />
            </div>
            <h2 className="text-foreground text-lg font-semibold">
              Quick start
            </h2>
          </div>
          <p className="text-muted-foreground text-sm">
            New to test series? Here&apos;s the shortest path from a blank slate
            to a live, sellable series.
          </p>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {guideSteps.map((s, idx) => (
              <li
                key={s.title}
                className="bg-muted/30 flex gap-3 rounded-lg border p-3"
              >
                <span className="bg-primary/10 text-primary inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {s.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Tip: AI buttons next to title, description, and cover image speed
            up authoring. Generation runs in the background so you can keep
            editing.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
