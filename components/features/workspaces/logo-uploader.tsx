"use client";

import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import { ImageUp } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { removeWorkspaceLogo, uploadWorkspaceLogo } from "@/services/workspaces/actions";
import { LOGO_TYPES, MAX_LOGO_BYTES } from "@/services/workspaces/constants";

const ACCEPT = LOGO_TYPES.join(",");

/** Checked here for instant feedback; the server checks the bytes again. */
function validate(file: File): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return "Upload a PNG or JPEG image.";
  if (file.size > MAX_LOGO_BYTES) return "Logos must be under 2 MB.";
  return null;
}

function LogoPreview({ src, className }: { src: string; className?: string }) {
  return (
    // Plain <img>: blob previews and Storage URLs gain nothing from next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Workspace logo" className={cn("max-h-16 max-w-48 object-contain", className)} />
  );
}

type LogoUploaderProps = { workspaceId: string; logoUrl: string | null; canEdit: boolean };

export function LogoUploader({ workspaceId, logoUrl, canEdit }: LogoUploaderProps) {
  const [pending, startTransition] = useTransition();
  // Shows the picked file at once; the server's URL replaces it on refresh.
  const [logo, setOptimisticLogo] = useOptimistic(logoUrl);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid min-h-28 place-items-center rounded-xl border border-hairline bg-ground p-6">
          {logo ? <LogoPreview src={logo} /> : <p className="text-sm text-ink-muted">No logo yet</p>}
        </div>
        <p className="text-[13px] text-ink-muted">Only workspace owners can change the logo.</p>
      </div>
    );
  }

  function upload(file: File | undefined) {
    if (!file || pending) return;
    const problem = validate(file);
    setError(problem);
    if (problem) return;

    const preview = URL.createObjectURL(file);
    startTransition(async () => {
      setOptimisticLogo(preview);
      const formData = new FormData();
      formData.set("workspaceId", workspaceId);
      formData.set("logo", file);
      const result = await uploadWorkspaceLogo(formData);
      if (!result.ok) setError(result.error);
      URL.revokeObjectURL(preview);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      setOptimisticLogo(null);
      const result = await removeWorkspaceLogo(workspaceId);
      if (!result.ok) setError(result.error);
    });
  }

  function onDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = pending ? "none" : "copy";
    if (!dragging) setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLLabelElement>) {
    // Ignore leaving into a child element.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    upload(event.dataTransfer.files[0]);
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-busy={pending || undefined}
        className={cn(
          "relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center",
          "transition-colors duration-150 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-surface",
          dragging
            ? "border-accent bg-accent-surface"
            : "border-hairline-strong bg-ground hover:border-ink-muted/50",
          pending && "cursor-wait",
        )}
      >
        <input
          type="file"
          accept={ACCEPT}
          disabled={pending}
          className="sr-only"
          onChange={(event) => {
            upload(event.target.files?.[0]);
            // Let the same file be picked again after an error.
            event.target.value = "";
          }}
        />

        {logo ? (
          <LogoPreview src={logo} className={cn("transition-opacity", pending && "opacity-50")} />
        ) : (
          <span className="grid size-10 place-items-center rounded-full border border-hairline bg-surface text-ink-muted">
            <ImageUp aria-hidden className="size-5" />
          </span>
        )}

        <span className="text-sm">
          <span className="font-medium text-ink">
            {logo ? "Drop a new logo to replace it" : "Drop your logo here"}
          </span>
          <span className="text-ink-muted">
            {" "}
            or <span className="font-medium text-accent underline-offset-2 hover:underline">browse</span>
          </span>
        </span>
        <span className="text-[13px] text-ink-muted">PNG or JPEG, up to 2 MB</span>

        {pending && (
          <span
            role="status"
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-xs text-ink-muted"
          >
            <Spinner className="size-3.5" />
            Saving…
          </span>
        )}
      </label>

      {error && (
        <Alert>
          <p>{error}</p>
        </Alert>
      )}

      {logo && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className={buttonClass("secondary", "h-9 px-3")}
          >
            Remove logo
          </button>
        </div>
      )}
    </div>
  );
}
