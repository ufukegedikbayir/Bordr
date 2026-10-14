import Link from "next/link";
import type { ReactNode, Ref } from "react";

type AuthCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
};

export function AuthCard({ title, description, children, footer, titleRef }: AuthCardProps) {
  return (
    <div className="w-full max-w-[400px]">
      <div className="rounded-xl border border-hairline bg-surface p-6 shadow-card sm:p-8">
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-[-0.015em] text-balance text-ink outline-none"
        >
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm leading-[1.375rem] text-pretty text-ink-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>}
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-sm font-medium text-ink underline decoration-hairline-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}
