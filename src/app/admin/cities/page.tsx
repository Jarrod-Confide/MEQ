import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { getExpansionProgress } from "@/lib/goals-data";
import { lastQuarters, quarterOf, yearOf } from "@/lib/performance";
import { CITY_GEO } from "@/lib/cities";
import { TERRITORY_COLOR, TERRITORY_LABEL, TERRITORY_ORDER, territoryFromCity } from "@/lib/territory";
import { addExpansionCity, deleteExpansionCity, updateExpansionCity } from "../actions";

export const dynamic = "force-dynamic";

const num = "w-16 rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[13px] tabular-nums text-white";
const sel = "rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[13px] text-white";

function RegionSelect({ value }: { value: string }) {
  return (
    <select name="region" defaultValue={value} className={sel}>
      {TERRITORY_ORDER.map((t) => (
        <option key={t} value={t}>{TERRITORY_LABEL[t]}</option>
      ))}
    </select>
  );
}

export default async function ExpansionCitiesPage() {
  const now = new Date();
  const q = quarterOf(now);
  const y = yearOf(now);
  const cities = await getExpansionProgress(q, y, lastQuarters(now, 4));
  const listed = new Set(cities.map((c) => c.city));
  const options = Object.keys(CITY_GEO).filter((c) => !listed.has(c)).sort();

  return (
    <div className="min-h-screen">
      <PageHeader eyebrow="MEQ · Admin" title="Expansion cities">
        <Link href="/admin" prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">← Admin</Link>
      </PageHeader>

      <main className="space-y-6 px-4 py-5 md:px-6">
        <p className="m-0 max-w-3xl text-[13px] text-[#9bb0d4]">
          Cities where we want enough members to host events. A new member counts toward a city when their Closest
          Major City matches and they become an Active member in HubSpot (the working definition of
          &ldquo;onboarded&rdquo; until the team settles it). The region decides which community manager the city
          belongs to. Each city has a goal and a stretch goal for the quarter and for the year.
        </p>

        <section className="overflow-x-auto rounded-lg border border-[#1f2a3d] bg-[#111726]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[#6a7da0]">
                <th className="px-5 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">
                  Region · {q.label}: new, goal, stretch · {y.label}: new, goal, stretch · Active
                </th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {cities.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-6 text-center text-[#6a7da0]">No expansion cities yet. Add one below.</td></tr>
              )}
              {cities.map((c) => (
                <tr key={c.id} className="border-t border-[#141c2b] align-middle">
                  <td className="px-5 py-2">
                    <div className="flex items-center gap-2 text-[#cfdaee]">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: TERRITORY_COLOR[c.region] }} />
                      {c.city}
                    </div>
                    <div className="text-[11px] text-[#6a7da0]">{c.totalMembers} members today</div>
                  </td>
                  <td className="px-3 py-2">
                    <form id={`city-${c.id}`} action={updateExpansionCity} className="grid grid-cols-[auto_auto_auto_auto] items-center gap-x-6">
                      <input type="hidden" name="id" value={c.id} />
                      <RegionSelect value={c.region} />
                      <span className="flex items-center gap-1.5">
                        <b className="w-6 text-right tabular-nums text-white">{c.quarter.actual}</b>
                        <input name="quarterGoal" type="number" min={0} defaultValue={c.quarter.goal} className={num} />
                        <input name="quarterStretch" type="number" min={0} defaultValue={c.quarter.stretch} className={num} />
                      </span>
                      <span className="flex items-center gap-1.5">
                        <b className="w-6 text-right tabular-nums text-white">{c.year.actual}</b>
                        <input name="yearGoal" type="number" min={0} defaultValue={c.year.goal} className={num} />
                        <input name="yearStretch" type="number" min={0} defaultValue={c.year.stretch} className={num} />
                      </span>
                      <span className="flex items-center gap-3">
                        <input type="checkbox" name="active" defaultChecked={c.active} className="accent-[#8ab4ff]" />
                        <SubmitButton pendingText="Saving…" className="rounded-md border border-[#2d3d5c] px-2 py-1 text-[11px] text-[#8ab4ff] hover:bg-[#1a2238]">Save</SubmitButton>
                      </span>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={deleteExpansionCity}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton pendingText="Removing…" className="rounded-md border border-[#3d2d2d] px-2 py-1 text-[11px] text-[#f87171] hover:bg-[#2a1a1a]">Remove</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 border-t border-[#1f2a3d] px-5 py-2 text-[11px] text-[#6a7da0]">
            Untick Active to pause a city without losing it: paused cities drop off the Dashboard.
          </p>
        </section>

        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
          <h2 className="m-0 mb-3 text-[13px] uppercase tracking-wide text-[#9bb0d4]">Add a city</h2>
          <form action={addExpansionCity} className="flex flex-wrap items-end gap-4">
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              City (as members pick it)
              <input
                name="city"
                list="known-cities"
                required
                placeholder="e.g. Pittsburgh"
                className="mt-1 block w-56 rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2.5 py-1.5 text-[13px] normal-case text-white placeholder:text-[#6a7da0]"
              />
              <datalist id="known-cities">
                {options.map((c) => (
                  <option key={c} value={c}>{TERRITORY_LABEL[territoryFromCity(c)]}</option>
                ))}
              </datalist>
            </label>
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Region
              <div className="mt-1"><RegionSelect value="NE" /></div>
            </label>
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Quarter goal · stretch
              <span className="mt-1 flex gap-1.5">
                <input name="quarterGoal" type="number" min={0} defaultValue={5} className={num} />
                <input name="quarterStretch" type="number" min={0} defaultValue={7} className={num} />
              </span>
            </label>
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Year goal · stretch
              <span className="mt-1 flex gap-1.5">
                <input name="yearGoal" type="number" min={0} defaultValue={20} className={num} />
                <input name="yearStretch" type="number" min={0} defaultValue={28} className={num} />
              </span>
            </label>
            <SubmitButton pendingText="Adding…" className="rounded-md bg-[#8ab4ff] px-4 py-1.5 text-[13px] font-semibold text-[#0b0f17] hover:bg-[#a5c4ff]">Add city</SubmitButton>
          </form>
        </section>
      </main>
    </div>
  );
}
