/**
 * Route-transition feedback — shows instantly while any page's server render
 * is in flight, so navigation never feels dead.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-[13px] text-[#9bb0d4]">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#2d3d5c] border-t-[#8ab4ff]" />
        Loading…
      </div>
    </div>
  );
}
