import { fetchMemberMap } from "@/lib/members";

export const revalidate = 300;

export default async function UnmatchedPage() {
  const { unmatched } = await fetchMemberMap();
  const total = unmatched.reduce((s, u) => s + u.members, 0);
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <a
        href="/"
        className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4] hover:text-white"
      >
        ← Back to map
      </a>
      <h1 className="mb-1 mt-4 text-2xl font-semibold">Unmatched Cities</h1>
      <p className="mb-8 max-w-prose text-[14px] leading-relaxed text-[#9bb0d4]">
        These <b className="text-[#fb923c]">{total}</b> members are tagged
        with a <code className="rounded bg-[#0b0f17] px-1.5 py-0.5 text-[#8ab4ff]">closest_major_city</code>{" "}
        value that isn&apos;t in MEQ&apos;s geo lookup. Add entries to{" "}
        <code className="rounded bg-[#0b0f17] px-1.5 py-0.5 text-[#8ab4ff]">src/lib/cities.ts</code>{" "}
        to plot them, or correct them in HubSpot if they&apos;re bad data.
      </p>
      {unmatched.length === 0 ? (
        <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-6 text-center text-[#9bb0d4]">
          Nothing unmatched. 🎯
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-[#1f2a3d] bg-[#111726]">
          {unmatched
            .sort((a, b) => b.members - a.members)
            .map((u) => (
              <li
                key={u.city}
                className="flex items-center justify-between border-b border-[#1a2238] px-4 py-3 text-[14px] last:border-b-0"
              >
                <span className="text-[#cfdaee]">{u.city}</span>
                <span className="font-semibold tabular-nums text-[#fb923c]">
                  {u.members}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
