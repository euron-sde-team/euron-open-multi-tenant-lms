"use client";

import { SafeLink } from "@open-mtlms/core";
import {
  ChevronDown,
  GraduationCap,
  LogOut,
  Bookmark,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccountDropdownProps {
  email?: string | null;
  myLearningHref?: string;
  name?: string | null;
  profileHref?: string;
  onLogout: () => void;
}

export function AccountDropdown({
  email,
  myLearningHref = "/my-learning",
  name,
  profileHref = "/profile",
  onLogout,
}: AccountDropdownProps) {
  const initials =
    name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 rounded-full px-2">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
            {initials}
          </div>
          <span className="hidden max-w-[120px] truncate text-sm font-medium lg:inline-block">
            {name || "Account"}
          </span>
          <ChevronDown className="hidden h-4 w-4 lg:inline-block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{name || "My Account"}</p>
            {email ? <p className="text-muted-foreground text-xs">{email}</p> : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <SafeLink href={profileHref} className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </SafeLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <SafeLink href={myLearningHref} className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span>My Learning</span>
          </SafeLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <SafeLink href="/bookmark" className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            <span>Bookmarks</span>
          </SafeLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
