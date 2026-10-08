import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { GoalBar, GoalLegend, PeriodBars, StatusPill } from "@/components/goal-ui";
import { EventTable, dateShort } from "@/components/EventTable";
import { LineChart } from "@/components/charts";
import { getViewer } from "@/lib/viewer";
import { resolveScope, scopeLabel, type Scope } from "@/lib/scope";
import {
  eventsInScope,
  getEngagementShare,
  getEngagementShareTrend,
  getEvents,
  getExpansionProgress,
  rollupAttendance,
} from "@/lib/goals-data";
import { getOutreach } from "@/lib/outreach";
import { goalStatus, inPeriod, lastQuarters, quarterOf, weeksIn, yearOf, type Period } from "@/lib/performance";
import { TERRITORY_COLOR, TERRITORY_LABEL, TERRITORY_ORDER } from "@/lib/territory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const card = "rounded-lg border border-[#1f2a3d] bg-[#111726] p-5";
const h2 = "m-0 text-[13px] uppercase tracking-wide text-[#9bb0d4]";

/** Fraction of a period elapsed (for the pace marker). */
function elapsed(p: Period, now: Date): number {
  return Math.min(1, Math.max(0, (now.getTime() - p.start.getTime()) / (p.end.getTime() - p.start.getTime())));
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region } = await searchParams;
  const now = new Date();
  const q = quarterOf(now);
  const y = yearOf(now);
  const quarters = lastQuarters(now, 4);

  // Waves of ≤4 queries (see db.ts): viewer + events, then the rest.
  const [viewer, eventData] = await Promise.all([getViewer(), getEvents()]);
  const scope: Scope = resolveScope(region, viewer);
  const [cities, share, shareTrend, outreach] = await Promise.all([
    getExpansionProgress(q, y, quarters),
    getEngagementShare(scope),
    getEngagementShareTrend(scope),
    Promise.all((scope === "ALL" ? (["ALL"] as const) : scope).map((t) => getOutreach(t))),
  ]);

  const settings = eventData.settings;
  const events = eventsInScope(eventData.events, scope).filter((e) => !e.isVirtual);
  const attQ = rollupAttendance(events, q);
  const attY = rollupAttendance(events, y);
  const quarterEvents = events.filter((e) => inPeriod(e.startsAt, q));
  const upcomingGoal = quarterEvents.filter((e) => !e.past && e.goal).reduce((s, e) => s + (e.goal?.goal ?? 0), 0);

  // Weekly, cumulative within the quarter: attended vs goal for events held so far.
  const qWeeks = weeksIn(q.start, q.end).filter((w) => w.getTime() <= now.getTime());
  const cumulative = qWeeks.map((w) => {
    const r = rollupAttendance(events.filter((e) => new Date(e.startsAt).getTime() < w.getTime() + 7 * 86400000), q);
    return { label: dateShort(w.toISOString()), actual: r.actual, goal: r.goal, stretch: r.stretch };
  });

  const scopedCities = cities.filter((c) => c.active && (scope === "ALL" || scope.includes(c.region)));
  const sum = (f: (c: (typeof scopedCities)[number]) => number) => scopedCities.reduce((s, c) => s + f(c), 0);
  const expQ = { actual: sum((c) => c.quarter.actual), goal: sum((c) => c.quarter.goal), stretch: sum((c) => c.quarter.stretch) };
  const expY = { actual: sum((c) => c.year.actual), goal: sum((c) => c.year.goal), stretch: sum((c) => c.year.stretch) };

  const needsAttention = new Set(
    outreach.flatMap((o) => o.segments.flatMap((s) => s.rows.map((r) => r.memberId ?? r.name ?? "")))
  ).size;

  const engGoal = settings.engagement.goalPct;
  const engStretch = settings.engagement.stretchPct;
  const mine = viewer.staff?.regions ?? [];

  return (
    <div className="min-h-screen">
      <PageHeader title={`Dashboard · ${scopeLabel(scope)}`}>
        <Link href="/dashboard" prefetch={false} className="text-[12px] text-[#6a7da0] hover:text-[#8ab4ff]">
          Membership overview →
        </Link>
      </PageHeader>

      <main className="space-y-6 px-4 py-5 md:px-6">
        {/* Scope switch */}
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          {mine.length > 0 && <ScopeChip href="/?region=mine" active={scope !== "ALL" && sameRegions(scope, mine)} label="My regions" />}
          <ScopeChip href="/?region=all" active={scope === "ALL"} label="All regions" />
          {TERRITORY_ORDER.map((t) => (
            <ScopeChip key={t} href={`/?region=${t}`} active={scope !== "ALL" && scope.length === 1 && scope[0] === t} label={TERRITORY_LABEL[t]} color={TERRITORY_COLOR[t]} />
          ))}
          <span className="ml-2 text-[#6a7da0]">
            {viewer.staff ? `Signed in as ${viewer.staff.name}` : viewer.email ? `Signed in as ${viewer.email}` : ""}
          </span>
        </div>

        {/* 1. Goals at a glance */}
        <section>
          <h2 className={`${h2} mb-3`}>Goals at a glance</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className={card}>
              <div className="mb-3 font-semibold text-white">Event attendance</div>
              <Label>{q.label}, events held so far</Label>
              <GoalBar actual={attQ.actual} goal={attQ.goal || null} stretch={attQ.stretch || null} />
              <div className="mt-4" />
              <Label>{y.label} to date</Label>
              <GoalBar actual={attY.actual} goal={attY.goal || null} stretch={attY.stretch || null} />
              <p className="mb-0 mt-3 text-[11px] text-[#6a7da0]">
                Active practitioners at events with a goal. {attQ.metGoal} of {attQ.events} events this quarter met their goal
                {attQ.metStretch ? `, ${attQ.metStretch} their stretch` : ""}.
                {upcomingGoal ? ` Events still to come this quarter add ${upcomingGoal} to the goal.` : ""}
              </p>
            </div>
            <div className={card}>
              <div className="mb-3 font-semibold text-white">New members in expansion cities</div>
              <Label>{q.label}</Label>
              <GoalBar actual={expQ.actual} goal={expQ.goal || null} stretch={expQ.stretch || null} expected={expQ.goal * elapsed(q, now)} />
              <div className="mt-4" />
              <Label>{y.label}</Label>
              <GoalBar actual={expY.actual} goal={expY.goal || null} stretch={expY.stretch || null} expected={expY.goal * elapsed(y, now)} />
              <p className="mb-0 mt-3 text-[11px] text-[#6a7da0]">
                {scopedCities.length
                  ? `${scopedCities.length} expansion ${scopedCities.length === 1 ? "city" : "cities"}. The yellow mark is where an even pace would be today.`
                  : "No expansion cities in this view yet. Admins add them in Admin → Expansion cities."}
              </p>
            </div>
            <div className={card}>
              <div className="mb-3 font-semibold text-white">Member engagement</div>
              <Label>Members who participated, last {share.windowDays} days</Label>
              <GoalBar actual={share.pct ?? 0} goal={engGoal} stretch={engStretch} unit="%" />
              <p className="mb-0 mt-3 text-[11px] text-[#6a7da0]">
                {share.participating.toLocaleString()} of {share.members.toLocaleString()} members attended an event (in person or virtual) or
                posted on Slack or Circle. Becomes a goal in Q1 2027{engGoal == null ? "; the goal isn't set yet" : ""}.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Event attendance */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className={card}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className={h2}>Event attendance by quarter</h2>
              <span className="text-[11px] text-[#6a7da0]">active practitioners vs goal</span>
            </div>
            <PeriodBars
              items={quarters.map((p) => {
                const r = rollupAttendance(events, p);
                return { label: p.label, actual: r.actual, goal: r.goal || null, stretch: r.stretch || null, partial: p.label === q.label };
              })}
            />
            <GoalLegend />
          </div>
          <div className={card}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className={h2}>{q.label} week by week</h2>
              <span className="text-[11px] text-[#6a7da0]">cumulative, events held so far</span>
            </div>
            {cumulative.length > 1 ? (
              <>
                <LineChart
                  labels={cumulative.map((c) => c.label)}
                  series={[
                    { label: "Stretch", color: "#22c55e", points: cumulative.map((c) => c.stretch) },
                    { label: "Goal", color: "#cfdaee", points: cumulative.map((c) => c.goal) },
                    { label: "Attended", color: "#8ab4ff", points: cumulative.map((c) => c.actual) },
                  ]}
                />
                <div className="mt-2 flex gap-4 text-[11px] text-[#6a7da0]">
                  <Legend color="#8ab4ff" label="Attended" />
                  <Legend color="#cfdaee" label="Goal" />
                  <Legend color="#22c55e" label="Stretch" />
                </div>
              </>
            ) : (
              <p className="text-[12px] text-[#6a7da0]">The quarter has just started; the weekly line appears after its first week.</p>
            )}
          </div>
        </section>

        <section className={card}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className={h2}>{q.label} events</h2>
            <Link href="/events" prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">All events by type →</Link>
          </div>
          <EventTable events={quarterEvents} />
          <p className="mb-0 mt-3 text-[11px] text-[#6a7da0]">
            Held events count active practitioners who attended; upcoming events show who&apos;s registered so far.
            Sponsors, vendors and Confide staff aren&apos;t counted.
          </p>
        </section>

        {/* 3. Expansion cities */}
        <section className={card}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className={h2}>Expansion cities</h2>
            {viewer.isAdmin && (
              <Link href="/admin/cities" prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">Manage cities →</Link>
            )}
          </div>
          {scopedCities.length === 0 ? (
            <p className="m-0 text-[12px] text-[#6a7da0]">No expansion cities in this view yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[#6a7da0]">
                    <th className="py-2 font-medium">City</th>
                    <th className="py-2 font-medium">Members</th>
                    <th className="py-2 font-medium">{q.label} new</th>
                    <th className="py-2 font-medium">{y.label} new</th>
                    <th className="py-2 font-medium">By quarter ({quarters[0].label} to {q.label})</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedCities.map((c) => (
                    <tr key={c.id} className="border-t border-[#141c2b]">
                      <td className="py-2 text-[#cfdaee]">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: TERRITORY_COLOR[c.region] }} />
                        {c.city}
                      </td>
                      <td className="py-2 tabular-nums text-[#9bb0d4]">{c.totalMembers}</td>
                      <td className="py-2"><RangeCell actual={c.quarter.actual} goal={c.quarter.goal} stretch={c.quarter.stretch} /></td>
                      <td className="py-2"><RangeCell actual={c.year.actual} goal={c.year.goal} stretch={c.year.stretch} /></td>
                      <td className="py-2"><Spark values={c.byQuarter} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 4. Engagement trend + 5. Needs attention */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
          <div className={card}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className={h2}>Member engagement over time</h2>
              <span className="text-[11px] text-[#6a7da0]">% of members participating, 90-day window, weekly</span>
            </div>
            {shareTrend.length > 1 ? (
              <>
                <LineChart
                  labels={shareTrend.map((p) => p.week.slice(5))}
                  yMax={Math.max(10, Math.ceil(Math.max(engStretch ?? 0, ...shareTrend.map((p) => p.pct)) / 10) * 10)}
                  series={[
                    ...(engStretch != null ? [{ label: "Stretch", color: "#22c55e", points: shareTrend.map(() => engStretch) }] : []),
                    ...(engGoal != null ? [{ label: "Goal", color: "#cfdaee", points: shareTrend.map(() => engGoal) }] : []),
                    { label: "Participating", color: "#a78bfa", points: shareTrend.map((p) => p.pct) },
                  ]}
                />
                <p className="mb-0 mt-2 text-[11px] text-[#6a7da0]">
                  Events (in person and virtual), Slack and Circle posts and replies.
                </p>
              </>
            ) : (
              <p className="text-[12px] text-[#6a7da0]">The trend fills in from the weekly snapshots (taken Mondays).</p>
            )}
          </div>
          <div className={card}>
            <h2 className={h2}>Needs attention</h2>
            <div className="mt-3 text-4xl font-bold tabular-nums text-[#fb923c]">{needsAttention}</div>
            <p className="mt-1 text-[12px] text-[#9bb0d4]">members on the follow-up lists: new members not yet participating, declining, and high-quality but quiet.</p>
            <Link href="/outreach" prefetch={false} className="text-[13px] text-[#8ab4ff] hover:underline">Open My Priorities →</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function sameRegions(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function ScopeChip({ href, active, label, color }: { href: string; active: boolean; label: string; color?: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={
        active
          ? "flex items-center gap-1.5 rounded-md border border-[#8ab4ff] bg-[#1a2238] px-2.5 py-1 text-white"
          : "flex items-center gap-1.5 rounded-md border border-[#2d3d5c] px-2.5 py-1 text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white"
      }
    >
      {color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
    </Link>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11px] uppercase tracking-wide text-[#6a7da0]">{children}</div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4" style={{ background: color }} />
      {label}
    </span>
  );
}

function RangeCell({ actual, goal, stretch }: { actual: number; goal: number; stretch: number }) {
  const status = goalStatus(actual, { goal, stretch });
  return (
    <span className="flex items-center gap-2">
      <b className="tabular-nums text-white">{actual}</b>
      <span className="text-[11px] text-[#6a7da0]">/ {goal} · {stretch}</span>
      {status !== "below" && <StatusPill status={status} />}
    </span>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <span className="flex h-6 items-end gap-1">
      {values.map((v, i) => (
        <span
          key={i}
          title={String(v)}
          className="w-3 rounded-sm bg-[#8ab4ff]"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: i === values.length - 1 ? 1 : 0.55 }}
        />
      ))}
    </span>
  );
}
