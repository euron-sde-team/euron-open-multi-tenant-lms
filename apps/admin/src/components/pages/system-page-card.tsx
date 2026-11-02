"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { BookOpen, ExternalLink, LogIn } from "lucide-react";
import Link from "next/link";

import type { SystemPage } from "@/lib/data/system-pages";

interface SystemPageCardProps {
  page: SystemPage;
  viewUrl: string;
}

export function SystemPageCard({ page, viewUrl }: SystemPageCardProps) {
  const fullViewUrl = `${viewUrl}${page.path}`;
  const isLogin = page.id === "login";
  const Icon = isLogin ? LogIn : BookOpen;

  return (
    <Card className="border-muted-foreground/30 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <Icon className="text-primary h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{page.name}</CardTitle>
              <CardDescription className="font-mono text-xs">{page.route}</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-muted-foreground">
            System
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 line-clamp-2 text-xs">{page.description}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1" asChild>
            <a href={fullViewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              View
            </a>
          </Button>
          {page.manageHref && (
            <Button variant="ghost" size="sm" className="gap-1" asChild>
              <Link href={page.manageHref}>{page.manageLabel ?? "Manage Courses"}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
