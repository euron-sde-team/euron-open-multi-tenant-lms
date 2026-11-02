"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@open-mtlms/core";
import {
  Award,
  BookOpen,
  CreditCard,
  GraduationCap,
  TrendingUp,
} from "lucide-react";

import { useMemberDetailStats } from "../../../lib/hooks/use-members";
import { RevenueBreakdownDisplay } from "../../shared/RevenueBreakdown";

interface OverviewTabProps {
  memberId: string;
}

export function OverviewTab({ memberId }: OverviewTabProps) {
  const { data: stats, isLoading } = useMemberDetailStats(memberId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-12 bg-muted/50 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    {
      icon: GraduationCap,
      value: String(stats?.enrollment_count ?? 0),
      label: "Enrollments",
    },
    {
      icon: BookOpen,
      value: String(stats?.book_access_count ?? 0),
      label: "Books",
    },
    {
      icon: Award,
      value: String(stats?.certificate_count ?? 0),
      label: "Certificates",
    },
    {
      icon: CreditCard,
      value: String(stats?.order_count ?? 0),
      label: "Orders",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {items.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <item.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total Spent card, full multi-currency breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {stats ? (
            <RevenueBreakdownDisplay
              value={stats.total_spent}
              variant="inline"
              showSubnote
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
