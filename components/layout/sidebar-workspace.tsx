import { getUserWorkspaces } from "@/services/workspaces/queries";

import { WorkspaceSwitcher } from "./workspace-switcher";

// Reads the session, so the layout renders it behind a Suspense boundary.
export async function SidebarWorkspace() {
  const result = await getUserWorkspaces();
  if (result.status !== "ok") return null;

  return <WorkspaceSwitcher workspaces={result.workspaces} active={result.active} />;
}
