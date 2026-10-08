"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutAction } from "@/app/actions/session";

/**
 * App navigation (approved 2026-10-06, sidebar since 2026-10-08 so MEQ works
 * on a phone): a fixed column on desktop, a menu button + slide-out drawer
 * below the md breakpoint. Admin shows only to admins; /admin is guarded too.
 */
const ITEMS = [
  { href: "/", label: "Dashboard", icon: "M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z" },
  { href: "/outreach", label: "My Priorities", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" },
  { href: "/engagement", label: "Members", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/new-members", label: "New Members", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m10-3v6m3-3h-6" },
  { href: "/dashboard", label: "Membership overview", icon: "M3 3v18h18M7 15l4-4 3 3 5-6" },
  { href: "/events", label: "Events", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2" },
  { href: "/territory", label: "Regions", icon: "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4zM8 2v16M16 6v16" },
  { href: "/admin", label: "Admin", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6m7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2", adminOnly: true },
] as const;

/** Which item a route belongs to (sub-pages light up their parent). */
export function sectionFor(path: string): string {
  if (path === "/") return "/";
  if (path.startsWith("/dashboard")) return "/dashboard";
  if (path.startsWith("/new-members")) return "/new-members";
  if (path.startsWith("/engagement") || path === "/quality") return "/engagement";
  if (path.startsWith("/territory") || path === "/map") return "/territory";
  if (path.startsWith("/admin")) return "/admin";
  if (path.startsWith("/events")) return "/events";
  if (path.startsWith("/outreach")) return "/outreach";
  return path;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function NavList({ isAdmin, active }: { isAdmin: boolean; active: string }) {
  return (
    <ul className="m-0 list-none space-y-0.5 p-0">
      {ITEMS.filter((i) => !("adminOnly" in i) || isAdmin).map((i) => (
        <li key={i.href}>
          <Link
            href={i.href}
            prefetch={false}
            aria-current={i.href === active ? "page" : undefined}
            className={
              i.href === active
                ? "flex items-center gap-3 rounded-md bg-[#1a2238] px-3 py-2 text-[13.5px] font-medium text-white"
                : "flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] text-[#9bb0d4] hover:bg-[#141c2b] hover:text-white"
            }
          >
            <Icon d={i.icon} />
            {i.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Footer({ who }: { who: string | null }) {
  return (
    <div className="border-t border-[#1f2a3d] px-4 py-3 text-[11px] text-[#6a7da0]">
      {who && <div className="mb-1.5 truncate" title={who}>{who}</div>}
      <form action={signOutAction}>
        <button type="submit" className="text-[#9bb0d4] hover:text-white">Sign out</button>
      </form>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" prefetch={false} className="block px-4 py-4">
      <div className="text-[15px] font-bold tracking-wide text-white">MEQ</div>
      <div className="text-[10.5px] uppercase tracking-[0.06em] text-[#6a7da0]">Member Engagement and Quality</div>
    </Link>
  );
}

export function Sidebar({ isAdmin, who }: { isAdmin: boolean; who: string | null }) {
  const pathname = usePathname() ?? "/";
  const active = sectionFor(pathname);
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating, and lock page scroll while it's open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Desktop: fixed column */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[#1f2a3d] bg-[#0d121e] md:flex">
        <Brand />
        <nav className="flex-1 overflow-y-auto px-2" aria-label="Main">
          <NavList isAdmin={isAdmin} active={active} />
        </nav>
        <Footer who={who} />
      </aside>

      {/* Phone: top bar + drawer */}
      <div className="sticky top-0 z-[1000] flex h-12 items-center justify-between border-b border-[#1f2a3d] bg-[#0d121e] px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md text-[#cfdaee] hover:bg-[#1a2238]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <span className="text-[14px] font-bold tracking-wide text-white">MEQ</span>
        <span className="w-9" />
      </div>
      {open && (
        <div className="fixed inset-0 z-[1001] md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 h-full w-full bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col border-r border-[#1f2a3d] bg-[#0d121e]">
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-[#9bb0d4] hover:bg-[#1a2238]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2" aria-label="Main">
              <NavList isAdmin={isAdmin} active={active} />
            </nav>
            <Footer who={who} />
          </aside>
        </div>
      )}
    </>
  );
}
