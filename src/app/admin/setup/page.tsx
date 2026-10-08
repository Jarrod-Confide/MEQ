import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { getSettings } from "@/lib/settings";
import { getEventTypes } from "@/lib/goals-data";
import { saveEventTiers, saveEventTypeGoals, saveEngagementMeasure } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "w-20 rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[13px] tabular-nums text-white placeholder:text-[#6a7da0]";
const saveBtn =
  "rounded-md bg-[#8ab4ff] px-4 py-1.5 text-[13px] font-semibold text-[#0b0f17] hover:bg-[#a5c4ff]";

export default async function SetupPage() {
  const [settings, types] = await Promise.all([getSettings(), getEventTypes()]);
  const tiers = [...settings.eventTiers, { minMembers: NaN, goal: NaN, stretch: NaN }]; // + one blank row to add a tier
  const m = settings.engagement;

  return (
    <div className="min-h-screen">
      <PageHeader eyebrow="MEQ · Admin" title="Setup" current="/admin/setup">
        <Link href="/admin" prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">← Admin</Link>
      </PageHeader>

      <main className="max-w-4xl space-y-6 px-6 py-5">
        <p className="m-0 text-[13px] text-[#9bb0d4]">
          The variables behind every goal in MEQ. Each goal has a <b className="text-white">goal</b> and a{" "}
          <b className="text-white">stretch goal</b>. Changes show on the Dashboard and Events straight away.
        </p>

        {/* Event attendance tiers */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
          <h2 className="m-0 text-[13px] uppercase tracking-wide text-[#9bb0d4]">Event attendance goals by city size</h2>
          <p className="mb-4 mt-1 text-[12px] text-[#6a7da0]">
            For event types set to &ldquo;By city size&rdquo; below. An event&apos;s goal comes from how many members were in its
            city on the day. Counts actual attendance by active practitioners (practicing security leaders; sponsors,
            vendors and Confide staff are excluded). Leave the last row blank, or fill it in to add a tier.
          </p>
          <form action={saveEventTiers} className="space-y-2">
            <div className="grid grid-cols-[150px_100px_100px] gap-3 text-[11px] uppercase tracking-wide text-[#6a7da0]">
              <span>Members in city, from</span>
              <span>Goal</span>
              <span>Stretch</span>
            </div>
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[150px_100px_100px] items-center gap-3">
                <input name={`min_${i}`} type="number" min={0} defaultValue={Number.isNaN(t.minMembers) ? "" : t.minMembers} placeholder="e.g. 200" className={input} />
                <input name={`goal_${i}`} type="number" min={0} defaultValue={Number.isNaN(t.goal) ? "" : t.goal} className={input} />
                <input name={`stretch_${i}`} type="number" min={0} defaultValue={Number.isNaN(t.stretch) ? "" : t.stretch} className={input} />
              </div>
            ))}
            <p className="text-[11px] text-[#6a7da0]">To remove a tier, clear its goal. The first tier always starts at 0.</p>
            <SubmitButton pendingText="Saving…" className={saveBtn}>Save tiers</SubmitButton>
          </form>
        </section>

        {/* Per event type */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
          <h2 className="m-0 text-[13px] uppercase tracking-wide text-[#9bb0d4]">Goals by event type</h2>
          <p className="mb-4 mt-1 text-[12px] text-[#6a7da0]">
            Every event type is tracked on the Events page. Choose which ones carry an attendance goal: by city size
            (the tiers above), a fixed goal for every event of that type (for example Anti-Summits), or no goal.
            Virtual events are counted, never given a goal.
          </p>
          <form action={saveEventTypeGoals}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[#6a7da0]">
                  <th className="py-2 font-medium">Event type</th>
                  <th className="py-2 font-medium">Goal</th>
                  <th className="py-2 font-medium">Fixed goal</th>
                  <th className="py-2 font-medium">Fixed stretch</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => {
                  const g = settings.eventTypeGoals[t.slug] ?? { mode: "none" as const };
                  return (
                    <tr key={t.slug} className="border-t border-[#141c2b]">
                      <td className="py-2 text-[#cfdaee]">
                        <input type="hidden" name="slug" value={t.slug} />
                        {t.name}
                        <span className="ml-2 text-[11px] text-[#6a7da0]">
                          {t.isVirtual ? "virtual · " : t.isAddon ? "add-on · " : ""}
                          {t.events} events
                        </span>
                      </td>
                      <td className="py-2">
                        {t.isVirtual ? (
                          <span className="text-[12px] text-[#6a7da0]">
                            <input type="hidden" name={`mode_${t.slug}`} value="none" />
                            Counted only
                          </span>
                        ) : (
                          <select
                            name={`mode_${t.slug}`}
                            defaultValue={g.mode}
                            className="rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[13px] text-white"
                          >
                            <option value="city">By city size</option>
                            <option value="fixed">Fixed</option>
                            <option value="none">No goal</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2">
                        {!t.isVirtual && (
                          <input name={`goal_${t.slug}`} type="number" min={0} defaultValue={g.mode === "fixed" ? g.goal : ""} className={input} />
                        )}
                      </td>
                      <td className="py-2">
                        {!t.isVirtual && (
                          <input name={`stretch_${t.slug}`} type="number" min={0} defaultValue={g.mode === "fixed" ? g.stretch : ""} className={input} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3">
              <SubmitButton pendingText="Saving…" className={saveBtn}>Save event types</SubmitButton>
            </div>
          </form>
        </section>

        {/* Engagement measure */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
          <h2 className="m-0 text-[13px] uppercase tracking-wide text-[#9bb0d4]">Member engagement measure</h2>
          <p className="mb-4 mt-1 text-[12px] text-[#6a7da0]">
            The share of a region&apos;s members who participated recently: attended a live event, or posted or replied on
            Slack or Circle. Circle visits join once Circle logins are captured. Becomes a goal from Q1 2027; leave the
            goal blank until it&apos;s agreed.
          </p>
          <form action={saveEngagementMeasure} className="flex flex-wrap items-end gap-5">
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Window
              <select
                name="windowDays"
                defaultValue={String(m.windowDays)}
                className="mt-1 block rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[13px] normal-case text-white"
              >
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 180 days</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-1 text-[13px] text-[#cfdaee]">
              <input type="checkbox" name="countReactions" defaultChecked={m.countReactions} className="accent-[#8ab4ff]" />
              Emoji reactions count as participating
            </label>
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Goal (% of members)
              <input name="goalPct" type="number" min={0} max={100} step="0.5" defaultValue={m.goalPct ?? ""} placeholder="not set" className={`mt-1 block ${input}`} />
            </label>
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Stretch (%)
              <input name="stretchPct" type="number" min={0} max={100} step="0.5" defaultValue={m.stretchPct ?? ""} placeholder="not set" className={`mt-1 block ${input}`} />
            </label>
            <SubmitButton pendingText="Saving…" className={saveBtn}>Save measure</SubmitButton>
          </form>
          <p className="mb-0 mt-3 text-[11px] text-[#6a7da0]">
            The trend line always uses a 90-day window (it&apos;s built from the weekly snapshots).
          </p>
        </section>
      </main>
    </div>
  );
}
