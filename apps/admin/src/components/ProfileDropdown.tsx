"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@open-mtlms/core";
import { ChevronDown, LogOut, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { useAuth, useLogout } from "@/lib/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * Get initials from a user's name (up to 2 characters).
 */
function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileDropdown() {
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const [avatarError, setAvatarError] = useState(false);

  const avatarUrl = user && "avatar_url" in user ? (user as { avatar_url?: string | null }).avatar_url : null;
  const hasAvatar = !!avatarUrl && !avatarError;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full overflow-hidden",
            !hasAvatar && "bg-primary/10"
          )}>
            {hasAvatar ? (
              <Image
                src={avatarUrl!}
                alt={user?.name || "Avatar"}
                width={32}
                height={32}
                className="h-full w-full object-cover"
                onError={() => setAvatarError(true)}
                unoptimized
              />
            ) : (
              <span className="text-xs font-medium text-primary">
                {getInitials(user?.name)}
              </span>
            )}
          </div>
          <span className="hidden text-sm font-medium lg:inline-block max-w-[120px] truncate">
            {user?.name || user?.email || "Account"}
          </span>
          <ChevronDown className="hidden h-4 w-4 opacity-50 lg:inline-block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user?.name || "User"}</p>
            <p className="text-muted-foreground text-xs truncate">
              {user?.email || ""}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{logoutMutation.isPending ? "Logging out..." : "Log out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
