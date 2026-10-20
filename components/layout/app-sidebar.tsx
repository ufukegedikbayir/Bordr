"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LayoutDashboard, LogOut, PackagePlus, Settings, type LucideIcon } from "lucide-react";

import { signOut } from "@/app/(app)/actions";
import { Logo } from "@/components/features/auth/logo";
import { cn } from "@/lib/utils/cn";

const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shipments/new", label: "New Shipment", icon: PackagePlus },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const FOOTER_ITEM = cn(
  "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium",
  "transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent",
);

// A top bar on small screens, a fixed-width rail from md up. The workspace
// switcher is a slot so the server can stream it in without blocking the shell.
export function AppSidebar({ workspaceSwitcher }: { workspaceSwitcher: ReactNode }) {
  const pathname = usePathname();
  const settingsActive = isActive(pathname, "/settings");

  return (
    <aside className="sticky top-0 z-10 flex items-center gap-3 border-b border-hairline bg-surface px-4 py-2.5 md:h-dvh md:flex-col md:items-stretch md:gap-6 md:border-r md:border-b-0 md:px-3 md:py-5">
      <div className="flex items-center gap-1 md:flex-col md:items-stretch md:gap-4">
        <Link
          href="/"
          aria-label="Bordr home"
          className="self-start rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Logo />
        </Link>
        {workspaceSwitcher}
      </div>

      <nav aria-label="Main" className="min-w-0 flex-1">
        <ul className="flex gap-0.5 md:flex-col md:gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-md px-2 text-sm md:gap-2.5 md:px-2.5 font-medium whitespace-nowrap",
                    "transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    active ? "bg-ground text-ink ring-1 ring-hairline" : "text-ink-muted hover:bg-ground hover:text-ink",
                  )}
                >
                  <Icon aria-hidden className={cn("hidden size-4 shrink-0 md:block", active && "text-accent")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Icon-only on small screens, where the top bar is tight. */}
      <div className="flex items-center gap-0.5 md:flex-col md:items-stretch md:gap-1 md:border-t md:border-hairline md:pt-3">
        <Link
          href="/settings"
          aria-current={settingsActive ? "page" : undefined}
          className={cn(
            FOOTER_ITEM,
            settingsActive ? "bg-ground text-ink ring-1 ring-hairline" : "text-ink-muted hover:bg-ground hover:text-ink",
          )}
        >
          <Settings aria-hidden className={cn("size-4 shrink-0", settingsActive && "text-accent")} />
          <span className="sr-only md:not-sr-only">Settings</span>
        </Link>
        <form action={signOut}>
          <button type="submit" className={cn(FOOTER_ITEM, "text-ink-muted hover:bg-ground hover:text-ink")}>
            <LogOut aria-hidden className="size-4 shrink-0" />
            <span className="sr-only md:not-sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
