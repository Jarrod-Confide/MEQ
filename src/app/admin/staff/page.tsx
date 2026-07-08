import Link from "next/link";
import { sql } from "drizzle-orm";
import { Nav } from "@/components/Nav";
import { meqDb, meqSql, schema } from "@/lib/db/meq";
import { TERRITORY_LABEL, TERRITORY_ORDER } from "@/lib/territory";
import { addStaff, updateStaffRegion, deleteStaff } from "./actions";

export const dynamic = "force-dynamic";

const REGION_OPTIONS = TERRITORY_ORDER.filter((t) => t !== "OTHER");

export default async function StaffAdminPage() {
  const [staffRows, unmatched, referralCounts] = await Promise.all([
    meqDb.select().from(schema.staff).orderBy(schema.staff.name),
    meqSql<{ normalized_raw: string; raw_name: string; n: number }[]>`
      SELECT normalized_raw, MIN(raw_name) raw_name, COUNT(*)::int n
      FROM member_referrals WHERE status = 'unmatched'
      GROUP BY normalized_raw ORDER BY n DESC, normalized_raw LIMIT 60`,
    meqDb
      .select({ status: schema.memberReferrals.status, n: sql<number>`count(*)::int` })
      .from(schema.memberReferrals)
      .groupBy(schema.memberReferrals.status),
  ]);

  const counts = Object.fromEntries(referralCounts.map((r) => [r.status, r.n]));

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">MEQ · Admin</div>
          <h1 className="m-0 text-xl font-semibold">Staff &amp; Referrals</h1>
        </div>
        <Nav current="/admin/staff" />
        <Link href="/territory" className="text-[12px] text-[#8ab4ff] hover:underline">← Regions</Link>
      </header>

      <main className="px-6 py-5 space-y-6">
        {/* Referral resolution summary */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Member referrals" value={counts.member ?? 0} color="#22c55e" sub="earn Connector credit" />
          <Stat label="Staff referrals" value={counts.staff ?? 0} color="#8ab4ff" sub="tracked, no credit" />
          <Stat label="Unmatched" value={counts.unmatched ?? 0} color="#facc15" sub="resolve below" />
          <Stat label="Ignored (junk)" value={counts.ignored ?? 0} color="#6a7da0" sub={'"n/a", "self", …'} />
        </section>

        {/* Staff registry */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726]">
          <div className="border-b border-[#1f2a3d] px-5 py-3">
            <h2 className="text-[13px] uppercase tracking-wide text-[#9bb0d4]">Staff</h2>
            <p className="m-0 mt-1 text-[11px] text-[#6a7da0]">
              Staff referrals are excluded from engagement scoring. Region assignment shows on the region dashboards. Aliases are extra spellings seen in the onboarding form (comma-separated). Changes apply on the next daily sync (or a manual sync).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[#6a7da0]">
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Aliases</th>
                  <th className="px-3 py-2 font-medium">Region</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {staffRows.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-[#6a7da0]">No staff yet — add below.</td></tr>
                )}
                {staffRows.map((s) => (
                  <tr key={s.id} className="border-t border-[#141c2b]">
                    <td className="px-5 py-2 text-[#cfdaee]">{s.name}</td>
                    <td className="px-3 py-2 text-[12px] text-[#9bb0d4]">{(s.aliases ?? []).join(", ") || "—"}</td>
                    <td className="px-3 py-2">
                      <form action={updateStaffRegion} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <select name="region" defaultValue={s.region ?? ""} className="rounded border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[12px] text-white">
                          <option value="">— none —</option>
                          {REGION_OPTIONS.map((t) => (
                            <option key={t} value={t}>{TERRITORY_LABEL[t]}</option>
                          ))}
                        </select>
                        <button type="submit" className="rounded-md border border-[#2d3d5c] px-2 py-1 text-[11px] text-[#8ab4ff] hover:bg-[#1a2238]">Save</button>
                      </form>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <form action={deleteStaff}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className="rounded-md border border-[#3d2d2d] px-2 py-1 text-[11px] text-[#f87171] hover:bg-[#2a1a1a]">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add staff */}
          <form action={addStaff} className="flex flex-wrap items-end gap-3 border-t border-[#1f2a3d] px-5 py-4">
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Name
              <input name="name" required placeholder="Full name" className="mt-1 block w-48 rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2.5 py-1.5 text-[13px] text-white placeholder:text-[#6a7da0]" />
            </label>
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Aliases (comma-separated)
              <input name="aliases" placeholder="larry whiteside jr, larry" className="mt-1 block w-72 rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2.5 py-1.5 text-[13px] text-white placeholder:text-[#6a7da0]" />
            </label>
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Region
              <select name="region" defaultValue="" className="mt-1 block rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1.5 text-[13px] text-white">
                <option value="">— none —</option>
                {REGION_OPTIONS.map((t) => (
                  <option key={t} value={t}>{TERRITORY_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-md bg-[#8ab4ff] px-4 py-1.5 text-[13px] font-semibold text-[#0b0f17] hover:bg-[#a5c4ff]">Add staff</button>
          </form>
        </section>

        {/* Unmatched referrer names */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726]">
          <div className="border-b border-[#1f2a3d] px-5 py-3">
            <h2 className="text-[13px] uppercase tracking-wide text-[#9bb0d4]">Unmatched referrer names</h2>
            <p className="m-0 mt-1 text-[11px] text-[#6a7da0]">
              Free-text names from the onboarding form that didn&apos;t match a member or staff. If it&apos;s a staff spelling, add it as an alias above; the next sync re-resolves everything automatically.
            </p>
          </div>
          {unmatched.length === 0 ? (
            <div className="px-5 py-6 text-center text-[13px] text-[#6a7da0]">Nothing unmatched. 🎉</div>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 px-5 py-3 sm:grid-cols-2 lg:grid-cols-3">
              {unmatched.map((u) => (
                <div key={u.normalized_raw} className="flex items-center justify-between border-b border-[#141c2b] py-1.5 text-[12px]">
                  <span className="text-[#cfdaee]">{u.raw_name}</span>
                  <span className="tabular-nums text-[#6a7da0]">×{u.n}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>{value.toLocaleString()}</div>
      <div className="mt-0.5 text-[11px] text-[#6a7da0]">{sub}</div>
    </div>
  );
}
