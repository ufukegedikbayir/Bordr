import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  // getUser() revalidates the session with the Supabase Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts should already have redirected; this guards against a matcher
  // gap, since the proxy must not be the only auth check.
  if (!user) redirect("/login");

  return (
    <div>
      <p>Bordr System Diagnostic: Core Architecture Online</p>
      <p>Database pipeline: online</p>
      <p>Authenticated as: {user.email ?? user.id}</p>
    </div>
  );
}
