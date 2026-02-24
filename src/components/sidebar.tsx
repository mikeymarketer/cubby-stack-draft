"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Film,
  Search,
  FolderOpen,
  Scissors,
  Settings,
  Upload,
  Menu,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Library", icon: Film },
  { href: "/search", label: "Search", icon: Search },
  { href: "/usable-moments", label: "Usable Moments", icon: Scissors },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  userEmail?: string;
  displayName?: string;
}

function DesktopNav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex-1 flex flex-col items-center gap-1 px-2 py-2">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
        return (
          <Tooltip key={href} delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                href={href}
                className={cn(
                  "flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function MobileNav({ pathname, onNav }: { pathname: string; onNav: () => void }) {
  return (
    <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNav}
            className={cn(
              "flex items-center h-10 px-3 gap-3 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/20 text-primary"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ userEmail = "", displayName = "" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : userEmail.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Desktop sidebar — icon-only, 64px, fixed */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden lg:flex flex-col w-16 bg-sidebar border-r border-sidebar-border">
        {/* Logo mark */}
        <div className="flex justify-center pt-4 pb-2 px-2">
          <Image
            src="/assets/cubby-stack-logo.png"
            alt="CubbyStack"
            width={36}
            height={36}
            className="rounded-xl"
            priority
          />
        </div>

        <DesktopNav pathname={pathname} />

        {/* User avatar + sign out */}
        <div className="py-3 flex flex-col items-center gap-2 px-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center h-10 w-10 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Sign out
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Avatar className="w-8 h-8 cursor-default">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {displayName || userEmail}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 flex items-center justify-center h-9 w-9 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-r border-sidebar-border">
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <Image
                  src="/assets/cubby-stack-logo.png"
                  alt="CubbyStack"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-base font-semibold text-foreground">CubbyStack</span>
              </div>
            </div>

            <MobileNav pathname={pathname} onNav={() => setMobileOpen(false)} />

            {/* User footer */}
            <div className="border-t border-sidebar-border p-4 flex items-center gap-3">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{displayName || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
              <button onClick={handleSignOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
