"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@open-mtlms/core";
import type { LucideIcon } from "lucide-react";

interface ComingSoonCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function ComingSoonCard({
  title,
  description,
  icon: Icon,
}: ComingSoonCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-muted/30" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            Coming Soon
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
