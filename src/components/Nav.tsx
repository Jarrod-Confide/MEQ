import Link from "next/link";

export const NAV_ITEMS = [
  { href: "/", label: "Map" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/engagement", label: "Engagement" },
  { href: "/quality", label: "Quality" },
  { href: "/meq", label: "Quadrant" },
  { href: "/territory", label: "Territory" },
  { href: "/outreach", label: "Outreach" },
] as const;

export function Nav({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap gap-1">
      {NAV_ITEMS.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={
            n.href === current
              ? "rounded-md border border-[#2d3d5c] bg-[#1a2238] px-3 py-1.5 text-[13px] text-white"
              : "rounded-md px-3 py-1.5 text-[13px] text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white"
          }
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
