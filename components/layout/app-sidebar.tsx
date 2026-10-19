"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, PackagePlus, type LucideIcon } from "lucide-react";

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

// A top bar on small screens, a fixed-width rail from md up.
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-10 flex items-center gap-4 border-b border-hairline bg-surface px-4 py-2.5 md:h-dvh md:flex-col md:items-stretch md:gap-6 md:border-r md:border-b-0 md:px-3 md:py-5">
      <Link
        href="/"
        aria-label="Bordr home"
        className="rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Logo />
      </Link>

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

      <form action={signOut} className="md:border-t md:border-hairline md:pt-3">
        <button
          type="submit"
          className={cn(
            "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-ink-muted",
            "transition-colors duration-150 outline-none hover:bg-ground hover:text-ink focus-visible:ring-2 focus-visible:ring-accent",
          )}
        >
          <LogOut aria-hidden className="size-4 shrink-0" />
          <span className="sr-only md:not-sr-only">Sign out</span>
        </button>
      </form>
    </aside>
  );
}
