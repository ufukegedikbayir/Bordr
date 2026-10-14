import { Logo } from "@/components/features/auth/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 justify-center px-4 pt-[6vh] pb-16 sm:pt-[11vh]">
        {children}
      </main>
    </div>
  );
}
