import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EventTable } from "@/components/EventTable";
import { StatusPill } from "@/components/goal-ui";
import { getViewer } from "@/lib/viewer";
import { resolveScope, scopeLabel, scopeParam, type Scope } from "@/lib/scope";
import { eventsInScope, getEvents, type EventRow } from "@/lib/goals-data";
import { inPeriod, lastQuarters, pctOf, quarterOf, yearOf, type Period } from "@/lib/performance";
import { TERRITORY_COLOR, TERRITORY_LABEL, TERRITORY_ORDER } from "@/lib/territory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const card = "rounded-lg border border-[#1f2a3d] bg-[#111726] p-5";
const h2 = "m-0 text-[13px] uppercase tracking-wide text-[#9bb0d4]";

type PeriodKey = "up" | "q" | "lq" | "y" | "all";

function periodFor(key: PeriodKey, now: Date): Period | null {
  if (key === "q") return quarterOf(now);
  if (key === "lq") return lastQuarters(now, 2)[0];
  if (key === "y") return yearOf(now);
  return null;
}

type TypeSummary = {
  name: string;
  slug: string;
  isVirtual: boolean;
  events: number;
  attended: number;
  practitioners: number;
  members: number;
  withGoal: number;
  goal: number;
  stretch: number;
  goalActual: number;
  metGoal: number;
  metStretch: number;
  upcoming: number; // events still to come
  registered: number; // active practitioners registered for them
  needPeople: number; // upcoming events with a goal, registrations below it
};

function summarize(events: EventRow[]): TypeSummary[] {
  const by = new Map<string, TypeSummary>();
  for (const e of events) {
    const slug = e.typeSlug ?? "unknown";
    let s = by.get(slug);
    if (!s) {
      s = { name: e.typeName ?? "Unknown type", slug, isVirtual: e.isVirtual, events: 0, attended: 0, practitioners: 0, members: 0, withGoal: 0, goal: 0, stretch: 0, goalActual: 0, metGoal: 0, metStretch: 0, upcoming: 0, registered: 0, needPeople: 0 };
      by.set(slug, s);
    }
    if (!e.past) {
      s.upcoming++;
      s.registered += e.registered;
      if (e.goal && e.registered < e.goal.goal) s.needPeople++;
      continue;
    }
    s.events++;
    s.attended += e.attended;
    s.practitioners += e.practitioners;
    s.members += e.practitionerMembers;
    if (e.goal) {
      s.withGoal++;
      s.goal += e.goal.goal;
      s.stretch += e.goal.stretch;
      s.goalActual += e.practitioners;
      if (e.practitioners >= e.goal.goal) s.metGoal++;
      if (e.practitioners >= e.goal.stretch) s.metStretch++;
    }
  }
  return [...by.values()].sort(
    (a, b) => Number(a.isVirtual) - Number(b.isVirtual) || b.practitioners + b.registered - (a.practitioners + a.registered)
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; period?: string; type?: string }>;
}) {
  const { region, period, type } = await searchParams;
  const now = new Date();
  const periodKey: PeriodKey = period === "up" || period === "lq" || period === "y" || period === "all" ? period : "q";
  const p = periodFor(periodKey, now);

  const [viewer, { events: all }] = await Promise.all([getViewer(), getEvents()]);
  const scope: Scope = resolveScope(region ?? "all", viewer);
  // Virtual events belong to every region, so they appear in the all-regions view only.
  const inScope = eventsInScope(all, scope);
  // Upcoming events matter as much as held ones: they're where a CM can still act.
  const inWindow = inScope.filter((e) => (periodKey === "up" ? !e.past : !p || inPeriod(e.startsAt, p)));
  const held = inWindow.filter((e) => e.past);
  const upcoming = inWindow.filter((e) => !e.past);
  const summary = summarize(inWindow);
  const ofType = (e: EventRow) => !type || e.typeSlug === type;
  const listedUpcoming = upcoming.filter(ofType);
  const listedHeld = held.filter(ofType).reverse();

  const inPerson = held.filter((e) => !e.isVirtual);
  const virtual = held.filter((e) => e.isVirtual);
  const total = (xs: EventRow[], f: (e: EventRow) => number) => xs.reduce((s, e) => s + f(e), 0);

  const qs = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { region: scopeParam(scope), period: periodKey, type, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/events?${params.toString()}`;
  };
  const periodLabel = periodKey === "up" ? "Upcoming" : p ? p.label : "All time";
  const needPeople = upcoming.filter((e) => e.goal && e.registered < e.goal.goal).length;

  return (
    <div className="min-h-screen">
      <PageHeader title={`Events · ${scopeLabel(scope)}`} />

      <main className="space-y-6 px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          {(
            [
              ["up", "Upcoming"],
              ["q", "This quarter"],
              ["lq", "Last quarter"],
              ["y", "This year"],
              ["all", "All time"],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} href={qs({ period: k })} active={periodKey === k} label={label} />
          ))}
          <span className="mx-2 h-4 w-px bg-[#2d3d5c]" />
          <Chip href={qs({ region: "all" })} active={scope === "ALL"} label="All regions" />
          {TERRITORY_ORDER.map((t) => (
            <Chip key={t} href={qs({ region: t })} active={scope !== "ALL" && scope.length === 1 && scope[0] === t} label={TERRITORY_LABEL[t]} color={TERRITORY_COLOR[t]} />
          ))}
        </div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label="Upcoming events" value={upcoming.length} sub={`${upcoming.filter((e) => !e.isVirtual).length} in person, ${upcoming.filter((e) => e.isVirtual).length} virtual`} />
          <Stat label="Registered so far" value={total(upcoming, (e) => e.registered)} sub={needPeople ? `${needPeople} ${needPeople === 1 ? "event needs" : "events need"} people` : "active practitioners"} />
          <Stat label="In-person events held" value={inPerson.length} />
          <Stat label="Active practitioners attended" value={total(inPerson, (e) => e.practitioners)} sub={`${total(inPerson, (e) => e.practitionerMembers)} members, ${total(inPerson, (e) => e.practitioners - e.practitionerMembers)} non-members`} />
          <Stat label="Virtual events held" value={virtual.length} sub={scope === "ALL" ? "counted, no goal" : "shown in All regions"} />
          <Stat label="Virtual attendees" value={total(virtual, (e) => e.attended)} sub="scored at a lower weight than in person" />
        </section>

        <section className={card}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className={h2}>By event type · {periodLabel}</h2>
            {viewer.isAdmin && (
              <Link href="/admin/setup" prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">Set goals by type →</Link>
            )}
          </div>
          {summary.length === 0 ? (
            <p className="m-0 text-[12px] text-[#6a7da0]">No events in this period and view.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[#6a7da0]">
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 font-medium">Held</th>
                    <th className="py-2 font-medium">Practitioners</th>
                    <th className="py-2 font-medium">Members</th>
                    <th className="py-2 font-medium">Avg per event</th>
                    <th className="py-2 font-medium">Vs goal</th>
                    <th className="py-2 font-medium">Met goal · stretch</th>
                    <th className="py-2 font-medium">Upcoming · registered</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.slug} className="border-t border-[#141c2b]">
                      <td className="py-2 text-[#cfdaee]">
                        {s.name}
                        {s.isVirtual && <span className="ml-2 text-[11px] text-[#6a7da0]">virtual</span>}
                      </td>
                      <td className="py-2 tabular-nums">{s.events || ""}</td>
                      <td className="py-2 tabular-nums text-white">{s.isVirtual ? s.attended : s.practitioners}</td>
                      <td className="py-2 tabular-nums text-[#9bb0d4]">{s.members}</td>
                      <td className="py-2 tabular-nums text-[#9bb0d4]">{s.events ? ((s.isVirtual ? s.attended : s.practitioners) / s.events).toFixed(1) : ""}</td>
                      <td className="py-2 tabular-nums text-[#9bb0d4]">
                        {s.withGoal ? `${s.goalActual} of ${s.goal} (${pctOf(s.goalActual, s.goal)}%)` : s.events ? <span className="text-[#6a7da0]">no goal</span> : ""}
                      </td>
                      <td className="py-2 tabular-nums text-[#9bb0d4]">{s.withGoal ? `${s.metGoal} · ${s.metStretch} of ${s.withGoal}` : ""}</td>
                      <td className="py-2 tabular-nums text-[#9bb0d4]">
                        {s.upcoming ? `${s.upcoming} · ${s.registered}` : ""}
                        {s.needPeople > 0 && <span className="ml-1.5 text-[11px] text-[#fb923c]">{s.needPeople} need people</span>}
                      </td>
                      <td className="py-2 text-right">
                        <Link href={qs({ type: type === s.slug ? undefined : s.slug })} prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">
                          {type === s.slug ? "Show all" : "List"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mb-0 mt-3 text-[11px] text-[#6a7da0]">
                Practitioners are attendees who are practicing security leaders: sponsors, vendors and Confide staff
                aren&apos;t counted. Virtual types show everyone who attended.
              </p>
            </div>
          )}
        </section>

        {periodKey !== "lq" && (
          <section className={card}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className={h2}>
                Upcoming · {periodLabel}
                {type && ` · ${summary.find((x) => x.slug === type)?.name ?? type}`}
              </h2>
              {type && <Link href={qs({ type: undefined })} prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">All types</Link>}
            </div>
            <EventTable events={listedUpcoming} showYear={periodKey === "all" || periodKey === "up"} />
            <p className="mb-0 mt-3 text-[11px] text-[#6a7da0]">
              Active practitioners registered so far against each event&apos;s goal: &ldquo;Needs people&rdquo; is where to push.
            </p>
          </section>
        )}

        {periodKey !== "up" && (
          <section className={card}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className={h2}>
                Held · {periodLabel}
                {type && ` · ${summary.find((x) => x.slug === type)?.name ?? type}`}
              </h2>
              {type && <Link href={qs({ type: undefined })} prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">All types</Link>}
            </div>
            <EventTable events={listedHeld} showYear={periodKey === "all"} />
            {listedHeld.some((e) => e.goal) && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#6a7da0]">
                <StatusPill status="stretch" /> attended at least the stretch goal
                <StatusPill status="met" /> at least the goal
                <StatusPill status="below" /> under the goal
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Chip({ href, active, label, color }: { href: string; active: boolean; label: string; color?: string }) {
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

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-white">{value.toLocaleString()}</div>
      {sub && <div className="mt-1 text-[11px] text-[#6a7da0]">{sub}</div>}
    </div>
  );
}
