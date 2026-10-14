// Two territories with a border between them; the border is the green channel.
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-5">
        <path d="M8 4H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3z" fill="currentColor" />
        <path
          d="M12 4.75h3c.69 0 1.25.56 1.25 1.25v8c0 .69-.56 1.25-1.25 1.25h-3"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M10 1.5v17" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">Bordr</span>
    </span>
  );
}
