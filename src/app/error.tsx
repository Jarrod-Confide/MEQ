"use client";

import { useEffect } from "react";

/**
 * Page-level error boundary. Instead of a white "Application error" screen,
 * shows a friendly fallback with a retry, and reports the error to Slack
 * (via /api/report-error) so we hear about it before a user does.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/report-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        path: typeof window !== "undefined" ? window.location.pathname : "",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0f17] px-6 text-center">
      <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">MEQ</div>
      <h1 className="m-0 text-xl font-semibold text-white">This page hit a snag</h1>
      <p className="max-w-md text-[13px] text-[#9bb0d4]">
        Something went wrong loading this view. The team has been notified. You can retry, or head
        back to the map.
      </p>
      {error.digest && (
        <code className="rounded bg-[#111726] px-2 py-1 text-[11px] text-[#6a7da0]">
          ref: {error.digest}
        </code>
      )}
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="rounded-md bg-[#8ab4ff] px-4 py-2 text-[13px] font-semibold text-[#0b0f17]"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-md border border-[#2d3d5c] px-4 py-2 text-[13px] text-[#cfdaee] hover:bg-[#1a2238]"
        >
          Back to map
        </a>
      </div>
    </div>
  );
}
