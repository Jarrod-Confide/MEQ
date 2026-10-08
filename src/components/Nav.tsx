import Link from "next/link";
import { getViewer } from "@/lib/viewer";

/**
 * Top-level tabs (approved 2026-10-06). New Members joins when its page is
 * built (MQ-10). Admin shows only to admins; /admin itself is guarded too.
 */
const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/outreach", label: "My Priorities" },
  { href: "/engagement", label: "Members" },
  { href: "/events", label: "Events" },
  { href: "/territory", label: "Regions" },
  { href: "/admin", label: "Admin", adminOnly: true },
] as const;

/** Which tab a route belongs to (sub-pages light up their parent tab). */
function tabFor(path: string): string {
  if (path === "/" || path === "/dashboard") return "/";
  if (path.startsWith("/engagement") || path === "/quality") return "/engagement";
  if (path.startsWith("/territory") || path === "/map") return "/territory";
  if (path.startsWith("/admin")) return "/admin";
  return path;
}

export async function Nav({ current }: { current: string }) {
  const viewer = await getViewer().catch(() => null);
  const active = tabFor(current);
  return (
    <nav className="flex flex-wrap gap-1">
      {NAV_ITEMS.filter((n) => !("adminOnly" in n) || viewer?.isAdmin).map((n) => (
        <Link
          key={n.href}
          prefetch={false}
          href={n.href}
          className={
            n.href === active
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
