import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { meqDb, schema } from "@/lib/db/meq";
import { BOOTSTRAP_ADMINS, getViewer } from "@/lib/viewer";
import { addAdmin, removeAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const [rows, viewer] = await Promise.all([
    meqDb.select().from(schema.admins).orderBy(schema.admins.email),
    getViewer(),
  ]);
  const listed = new Set(rows.map((r) => r.email));
  const permanent = BOOTSTRAP_ADMINS.filter((e) => !listed.has(e));

  return (
    <div className="min-h-screen">
      <PageHeader eyebrow="MEQ · Admin" title="Admins">
        <Link href="/admin" prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">← Admin</Link>
      </PageHeader>
      <main className="max-w-2xl space-y-6 px-4 py-5 md:px-6">
        <p className="m-0 text-[13px] text-[#9bb0d4]">
          Admins can open Admin: Setup, expansion cities, staff and this list. Everyone else at Confide can use the
          rest of MEQ. Use the person&apos;s @confide.group sign-in address.
        </p>
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726]">
          <ul className="m-0 list-none p-0">
            {[...permanent.map((email) => ({ email, addedBy: null, permanent: true })), ...rows.map((r) => ({ ...r, permanent: BOOTSTRAP_ADMINS.includes(r.email) }))].map((a) => (
              <li key={a.email} className="flex items-center justify-between gap-3 border-b border-[#141c2b] px-5 py-2.5 text-[13px] last:border-b-0">
                <span className="text-[#cfdaee]">
                  {a.email}
                  {a.email === viewer.email && <span className="ml-2 text-[11px] text-[#6a7da0]">you</span>}
                </span>
                {a.permanent || a.email === viewer.email ? (
                  <span className="text-[11px] text-[#6a7da0]">{a.permanent ? "permanent" : "can't remove yourself"}</span>
                ) : (
                  <form action={removeAdmin}>
                    <input type="hidden" name="email" value={a.email} />
                    <SubmitButton pendingText="Removing…" className="rounded-md border border-[#3d2d2d] px-2 py-1 text-[11px] text-[#f87171] hover:bg-[#2a1a1a]">Remove</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <form action={addAdmin} className="flex flex-wrap items-end gap-3 border-t border-[#1f2a3d] px-5 py-4">
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Add an admin
              <input
                name="email"
                type="email"
                required
                pattern="[^@\s]+@confide\.group"
                placeholder="name@confide.group"
                className="mt-1 block w-72 rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2.5 py-1.5 text-[13px] normal-case text-white placeholder:text-[#6a7da0]"
              />
            </label>
            <SubmitButton pendingText="Adding…" className="rounded-md bg-[#8ab4ff] px-4 py-1.5 text-[13px] font-semibold text-[#0b0f17] hover:bg-[#a5c4ff]">Add admin</SubmitButton>
          </form>
        </section>
      </main>
    </div>
  );
}
