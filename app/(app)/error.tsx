"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // TODO: forward to error reporting service
    console.error(error);
  }, [error]);

  return (
    <div role="alert">
      <p>Something went wrong.</p>
      {error.digest && <p>Error ID: {error.digest}</p>}
      <button type="button" onClick={() => retry()}>
        Try again
      </button>
    </div>
  );
}
