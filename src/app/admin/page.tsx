import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin/setup", title: "Setup", body: "Goals and stretch goals for events by city size and event type, and the member-engagement measure." },
  { href: "/admin/cities", title: "Expansion cities", body: "The open list of cities we're growing into, the region that owns each, and its quarterly and annual goals." },
  { href: "/admin/staff", title: "Staff & referrals", body: "Everyone at Confide, their sign-in email and regions, and referrals that need a decision." },
  { href: "/admin/admins", title: "Admins", body: "Who can open Admin." },
  { href: "/admin/unmatched", title: "Unmatched cities", body: "Members whose Closest Major City isn't on the map yet." },
];

export default function AdminHome() {
  return (
    <div className="min-h-screen">
      <PageHeader eyebrow="MEQ · Admin" title="Admin" current="/admin" />
      <main className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            prefetch={false}
            className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5 hover:border-[#2d3d5c] hover:bg-[#141c2b]"
          >
            <div className="text-[15px] font-semibold text-white">{s.title}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#9bb0d4]">{s.body}</p>
          </Link>
        ))}
      </main>
    </div>
  );
}
