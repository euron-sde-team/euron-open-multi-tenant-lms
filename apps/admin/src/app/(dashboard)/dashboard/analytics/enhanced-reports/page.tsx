"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CreditCard,
  FileBarChart,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

interface ReportLink {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const ENHANCED_REPORTS: ReportLink[] = [
  {
    href: "/dashboard/analytics",
    title: "Business Overview",
    description: "High-level business metrics, revenue, users, and growth trends across all products",
    icon: BarChart3,
    color: "bg-cyan-500/10 text-cyan-500",
  },
  {
    href: "/dashboard/analytics/users",
    title: "User Intelligence",
    description: "Deep-dive into user activity, spending patterns, course completion, and engagement",
    icon: Users,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    href: "/dashboard/analytics/courses-analytics",
    title: "Course Performance",
    description: "Course-level metrics: enrollment funnel, completion rates, revenue attribution, and ratings",
    icon: GraduationCap,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    href: "/dashboard/analytics/books-analytics",
    title: "Book Analytics",
    description: "Book access patterns, sales performance, and reading engagement metrics",
    icon: BookOpen,
    color: "bg-indigo-500/10 text-indigo-500",
  },
  {
    href: "/dashboard/analytics/payments",
    title: "Revenue Analytics",
    description: "Revenue trends, order funnel analysis, and payment success rates",
    icon: CreditCard,
    color: "bg-emerald-500/10 text-emerald-500",
  },
  {
    href: "/dashboard/analytics/web-analytics",
    title: "Web Vitals",
    description: "Web analytics: page views, sessions, heatmaps, devices, and traffic sources",
    icon: TrendingUp,
    color: "bg-amber-500/10 text-amber-500",
  },
];

export default function EnhancedReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enhanced Reports</h1>
        <p className="text-sm text-muted-foreground">
          Curated analytical views combining multiple data sources for deeper insights
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ENHANCED_REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className="group h-full hover:shadow-md transition-all hover:border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className={`rounded-lg p-2.5 ${report.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="text-base mt-3">{report.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs leading-relaxed">
                    {report.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Custom Reports</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Advanced cross-referencing reports coming soon. These will combine data from multiple 
            sections to provide actionable insights like revenue attribution, user lifetime value, 
            and cohort analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Revenue Attribution by Channel",
              "User Lifetime Value Analysis",
              "Course Completion Cohort Report",
              "Conversion Funnel Analysis",
            ].map((title) => (
              <div key={title} className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                <span className="text-sm">{title}</span>
                <span className="ml-auto text-xs">Coming Soon</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
