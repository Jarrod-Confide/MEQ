"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshEngagement } from "@/app/engagement/actions";

export function RefreshButton({ computedAt }: { computedAt: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const when = new Date(computedAt);

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-[#6a7da0]">
        computed {when.toLocaleString()}
      </span>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await refreshEngagement();
            router.refresh();
          })
        }
        className="rounded-md border border-[#2d3d5c] bg-[#1a2238] px-3 py-1.5 text-[13px] text-white transition hover:bg-[#243150] disabled:opacity-50"
      >
        {pending ? "Refreshing…" : "↻ Refresh now"}
      </button>
    </div>
  );
}
