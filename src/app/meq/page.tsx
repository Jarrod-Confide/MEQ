import { getQuadrant } from "@/lib/quadrant-data";
import { QuadrantScatter } from "@/components/QuadrantScatter";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function MeqQuadrantPage() {
  const data = await getQuadrant();

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            MEQ · Member Engagement and Quality
          </div>
          <h1 className="m-0 text-xl font-semibold">Quality × Engagement Quadrant</h1>
        </div>
        <Nav current="/meq" />
        <div className="text-[11px] text-[#6a7da0]">{data.total.toLocaleString()} members</div>
      </header>

      <main className="px-6 py-5">
        <p className="mb-4 max-w-prose text-[12px] leading-relaxed text-[#6a7da0]">
          Every member plotted by <b className="text-[#9bb0d4]">quality</b> (who they are) ×{" "}
          <b className="text-[#9bb0d4]">engagement</b> (what they do). Drag the cut-points to
          redefine the quadrants and watch the counts move — the top-left{" "}
          <b className="text-[#fb923c]">priority-outreach</b> group (high quality, low engagement)
          is the one worth chasing. Click any dot to open that member. Once a split looks right we
          can lock it as the default.
        </p>
        <QuadrantScatter points={data.points} />
      </main>
    </div>
  );
}
