// Shell for authenticated dashboard routes. Auth guard goes here once
// lib/supabase is wired up.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
