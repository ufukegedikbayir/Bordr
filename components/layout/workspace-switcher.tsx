"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { setActiveWorkspace } from "@/services/workspaces/actions";
import type { Workspace } from "@/services/workspaces/queries";

const ROLE_LABEL = { owner: "Owner", member: "Member" } as const;

const ITEM = '[role="menuitemradio"]';

function WorkspaceAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-accent font-semibold text-accent-ink uppercase",
        className,
      )}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

function ActiveLabel({ workspace }: { workspace: Workspace }) {
  return (
    <span className="hidden min-w-0 flex-1 text-left md:block">
      <span className="block truncate text-sm font-medium text-ink">{workspace.name}</span>
      <span className="block text-xs text-ink-muted">{ROLE_LABEL[workspace.role]}</span>
    </span>
  );
}

const TRIGGER = cn(
  "flex h-11 w-full items-center gap-2.5 rounded-lg px-1.5 md:px-2",
  "outline-none focus-visible:ring-2 focus-visible:ring-accent",
);

/** Shows the active workspace; a menu switches between them when there's more than one. */
export function WorkspaceSwitcher({ workspaces, active: current }: { workspaces: Workspace[]; active: Workspace }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Shows the picked workspace at once while the server re-renders.
  const [active, setOptimisticActive] = useOptimistic(current);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    // Land on the current workspace, like a native select.
    rootRef.current?.querySelector<HTMLElement>(`${ITEM}[aria-checked="true"]`)?.focus();

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (workspaces.length < 2) {
    return (
      <div className={cn(TRIGGER, "cursor-default")} title={active.name}>
        <WorkspaceAvatar name={active.name} className="size-7 text-sm" />
        <ActiveLabel workspace={active} />
      </div>
    );
  }

  function select(workspace: Workspace) {
    setOpen(false);
    triggerRef.current?.focus();
    if (workspace.id === active.id) return;

    startTransition(async () => {
      setOptimisticActive(workspace);
      // The cookie write re-renders the layout and page with the new workspace.
      await setActiveWorkspace(workspace.id);
    });
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(ITEM));
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = {
      ArrowDown: (current + 1) % items.length,
      ArrowUp: (current - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    items[next]?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Workspace: ${active.name}. Switch workspace`}
        aria-busy={pending || undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          TRIGGER,
          "transition-colors duration-150 hover:bg-ground",
          open && "bg-ground ring-1 ring-hairline",
        )}
      >
        <WorkspaceAvatar name={active.name} className="size-7 text-sm" />
        <ActiveLabel workspace={active} />
        {pending ? (
          <Spinner className="size-3.5 shrink-0 text-ink-muted" />
        ) : (
          <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-ink-muted" />
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Workspaces"
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute top-full left-0 z-30 mt-1.5 w-64 origin-top-left rounded-lg border border-hairline bg-surface p-1 shadow-card md:w-full md:min-w-56",
            "transition-[opacity,scale] duration-150 ease-out starting:scale-[0.97] starting:opacity-0 motion-reduce:transition-none",
          )}
        >
          <p aria-hidden className="px-2 pt-1.5 pb-1 text-xs font-medium text-ink-muted">
            Workspaces
          </p>
          <div className="max-h-72 overflow-y-auto">
            {workspaces.map((workspace) => {
              const checked = workspace.id === active.id;
              return (
                <button
                  key={workspace.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  tabIndex={-1}
                  onClick={() => select(workspace)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-ink",
                    "outline-none hover:bg-ground focus-visible:bg-ground",
                  )}
                >
                  <WorkspaceAvatar name={workspace.name} className="size-5 text-[11px]" />
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  {checked && <Check aria-hidden className="size-4 shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Same footprint as the switcher, so the sidebar doesn't shift when it lands. */
export function WorkspaceSwitcherSkeleton() {
  return (
    <div aria-hidden className={TRIGGER}>
      <span className="skeleton size-7 shrink-0 rounded-md" />
      <span className="hidden flex-1 md:block">
        <span className="skeleton block h-3.5 w-28 rounded" />
        <span className="skeleton mt-1.5 block h-3 w-12 rounded" />
      </span>
    </div>
  );
}
