import { Suspense } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarWorkspace } from "@/components/layout/sidebar-workspace";
import { WorkspaceSwitcherSkeleton } from "@/components/layout/workspace-switcher";

// Shell for authenticated routes. proxy.ts guards access; pages that read
// user data re-check the session themselves.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <AppSidebar
        workspaceSwitcher={
          <Suspense fallback={<WorkspaceSwitcherSkeleton />}>
            <SidebarWorkspace />
          </Suspense>
        }
      />
      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
