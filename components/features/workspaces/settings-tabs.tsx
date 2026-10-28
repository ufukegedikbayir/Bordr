"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/settings", label: "Company" },
  { href: "/settings/team", label: "Team" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="mt-5 flex gap-1 border-b border-hairline">
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium outline-none transition-colors duration-150",
              "focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-accent",
              active ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
