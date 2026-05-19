import type { CityPoint } from "@/lib/members";

export function CityList({ points }: { points: CityPoint[] }) {
  const top = points.slice(0, 25);
  return (
    <ul className="m-0 list-none p-0">
      {top.map((c) => (
        <li
          key={c.name}
          className="flex items-center justify-between border-b border-[#1a2238] px-1 py-2 text-[13px] last:border-b-0"
        >
          <span className="text-[#cfdaee]">{c.name}</span>
          <span className="font-semibold tabular-nums text-[#8ab4ff]">
            {c.members}
          </span>
        </li>
      ))}
    </ul>
  );
}
