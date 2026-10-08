import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { BarChart, LineChart } from "@/components/charts";
import { getViewer } from "@/lib/viewer";
import { resolveScope, scopeLabel, scopeParam, type Scope } from "@/lib/scope";
import { getJoinedMembers, getMilestonesComputedAt, type JoinedMember } from "@/lib/new-members-data";
import {
  CHANNELS,
  DEFAULT_CHANNELS,
  ENGAGE_BANDS,
  GRAINS,
  bucketJoins,
  bucketStart,
  daysToEngage,
  defaultGrain,
  firstEngagement,
  median,
  type Channel,
  type Grain,
} from "@/lib/new-members";
import { TERRITORY_COLOR, TERRITORY_LABEL, TERRITORY_ORDER } from "@/lib/territory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const card = "rounded-lg border border-[#1f2a3d] bg-[#111726] p-5";
const h2 = "m-0 text-[13px] uppercase tracking-wide text-[#9bb0d4]";
const DAY = 86400000;

const PRESETS = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "12m", label: "Last 12 months" },
  { key: "ytd", label: "This year" },
  { key: "all", label: "All time" },
] as const;

type Params = { from?: string; to?: string; range?: string; grain?: string; region?: string; ch?: string };

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function parseDay(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

function resolveRange(p: Params, earliest: Date, today: Date): { from: Date; to: Date; preset: string | null } {
  const from = parseDay(p.from);
  const to = parseDay(p.to);
  if (from && to && from <= to) return { from, to, preset: null };
  const key = PRESETS.some((x) => x.key === p.range) ? p.range! : "12m";
  if (key === "30d") return { from: new Date(today.getTime() - 29 * DAY), to: today, preset: key };
  if (key === "90d") return { from: new Date(today.getTime() - 89 * DAY), to: today, preset: key };
  if (key === "ytd") return { from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), to: today, preset: key };
  if (key === "all") return { from: earliest, to: today, preset: key };
  return { from: new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth() + 1, 1)), to: today, preset: "12m" };
}

const CHANNEL_SHORT: Record<Channel, string> = { event: "in-person event", virtual: "virtual event", post: "post", reaction: "reaction" };

function engagedVia(m: JoinedMember, channels: Channel[], at: string): Channel | null {
  const by: Record<Channel, string | null> = { event: m.firstEventAt, virtual: m.firstVirtualAt, post: m.firstPostAt, reaction: m.firstReactionAt };
  return channels.find((c) => by[c] === at) ?? null;
}

export default async function NewMembersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const viewer = await getViewer(); // first: keeps concurrent queries within the pool (lib/db.ts)
  const [all, computedAt] = await Promise.all([getJoinedMembers(), getMilestonesComputedAt()]);
  const scope: Scope = resolveScope(params.region ?? "all", viewer);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const earliest = all.reduce((min, m) => (m.joinedAt < min ? m.joinedAt : min), isoDay(today));
  const { from, to, preset } = resolveRange(params, bucketStart(new Date(earliest), "month"), today);
  const grain: Grain = GRAINS.includes(params.grain as Grain) ? (params.grain as Grain) : defaultGrain(from, to);
  const channels: Channel[] = params.ch
    ? (params.ch.split(",").filter((c) => CHANNELS.some((x) => x.key === c)) as Channel[])
    : DEFAULT_CHANNELS;

  const inScope = all.filter((m) => scope === "ALL" || scope.includes(m.region));
  const endExcl = to.getTime() + DAY;
  const joined = inScope.filter((m) => {
    const t = new Date(m.joinedAt).getTime();
    return t >= from.getTime() && t < endExcl;
  });
  const span = endExcl - from.getTime();
  const prior = inScope.filter((m) => {
    const t = new Date(m.joinedAt).getTime();
    return t >= from.getTime() - span && t < from.getTime();
  }).length;
  const buckets = bucketJoins(joined.map((m) => new Date(m.joinedAt)), from, to, grain);
  const change = prior ? Math.round(((joined.length - prior) / prior) * 100) : null;

  // ── Time to first engagement ──
  const withEngage = joined.map((m) => {
    const at = channels.length ? firstEngagement(m, channels) : null;
    return { m, at, days: at ? daysToEngage(m.joinedAt, at) : null };
  });
  const engaged = withEngage.filter((x) => x.days !== null);
  const days = engaged.map((x) => x.days as number);
  const med = median(days);
  // "Within 30 days" only over members who've had 30 days to do it.
  const matured = withEngage.filter((x) => now.getTime() - new Date(x.m.joinedAt).getTime() >= 30 * DAY);
  const within30 = matured.filter((x) => x.days !== null && x.days <= 30).length;
  const bands: { label: string; value: number }[] = ENGAGE_BANDS.map((b, i) => {
    const lo = i === 0 ? -1 : ENGAGE_BANDS[i - 1].max;
    return { label: b.label, value: days.filter((d) => d > lo && d <= b.max).length };
  });
  bands.push({ label: "Not yet", value: withEngage.length - engaged.length });

  // Cohorts: share engaged within 30 days, per join bucket (weekly at finest).
  const cohortGrain: Grain = grain === "day" ? "week" : grain;
  const cohorts = bucketJoins([], from, to, cohortGrain).map((b) => {
    const members = matured.filter((x) => bucketStart(new Date(x.m.joinedAt), cohortGrain).getTime() === b.start.getTime());
    const ok = members.filter((x) => x.days !== null && x.days <= 30).length;
    return { label: b.label, n: members.length, pct: members.length ? Math.round((ok / members.length) * 100) : null };
  }).filter((c) => c.pct !== null);

  const recent = [...withEngage].sort((a, b) => b.m.joinedAt.localeCompare(a.m.joinedAt)).slice(0, 30);

  const qs = (over: Partial<Params>) => {
    const p = new URLSearchParams();
    const base: Params = {
      region: scopeParam(scope),
      grain: params.grain,
      ch: params.ch,
      ...(preset ? { range: preset } : { from: isoDay(from), to: isoDay(to) }),
    };
    for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
    return `/new-members?${p.toString()}`;
  };
  const toggleChannel = (c: Channel) => {
    const next = channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c];
    return qs({ ch: next.join(",") || "none" });
  };
  const rangeLabel = preset ? PRESETS.find((p) => p.key === preset)!.label : `${isoDay(from)} to ${isoDay(to)}`;
  const definition = channels.length ? channels.map((c) => CHANNEL_SHORT[c]).join(", ") : "nothing selected";

  return (
    <div className="min-h-screen">
      <PageHeader title={`New Members · ${scopeLabel(scope)}`} />

      <main className="space-y-6 px-4 py-5 md:px-6">
        {/* Controls */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            {PRESETS.map((p) => (
              <Chip key={p.key} href={qs({ range: p.key, from: undefined, to: undefined, grain: undefined })} active={preset === p.key} label={p.label} />
            ))}
          </div>
          <form action="/new-members" className="flex flex-wrap items-end gap-3 text-[12px]">
            <input type="hidden" name="region" value={scopeParam(scope)} />
            {params.ch && <input type="hidden" name="ch" value={params.ch} />}
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              From
              <input type="date" name="from" defaultValue={isoDay(from)} className="mt-1 block rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[13px] text-white [color-scheme:dark]" />
            </label>
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              To
              <input type="date" name="to" defaultValue={isoDay(to)} className="mt-1 block rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[13px] text-white [color-scheme:dark]" />
            </label>
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Group by
              <select name="grain" defaultValue={grain} className="mt-1 block rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[13px] normal-case text-white">
                {GRAINS.map((g) => (
                  <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-md bg-[#8ab4ff] px-3 py-1.5 text-[13px] font-semibold text-[#0b0f17] hover:bg-[#a5c4ff]">Apply</button>
          </form>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <Chip href={qs({ region: "all" })} active={scope === "ALL"} label="All regions" />
            {TERRITORY_ORDER.map((t) => (
              <Chip key={t} href={qs({ region: t })} active={scope !== "ALL" && scope.length === 1 && scope[0] === t} label={TERRITORY_LABEL[t]} color={TERRITORY_COLOR[t]} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={`New members · ${rangeLabel}`} value={String(joined.length)} sub={change == null ? "no earlier period to compare" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs the ${prior} before it`} />
          <Stat label={`Average per ${grain}`} value={(joined.length / Math.max(1, buckets.length)).toFixed(1)} sub={`${buckets.length} ${grain}s`} />
          <Stat label="Engaged since joining" value={joined.length ? `${Math.round((engaged.length / joined.length) * 100)}%` : "–"} sub={`${engaged.length} of ${joined.length}`} />
          <Stat label="Median days to engage" value={med == null ? "–" : String(Math.round(med))} sub={matured.length ? `${Math.round((within30 / matured.length) * 100)}% engage within 30 days` : "too recent to tell"} />
        </section>

        {/* New members chart */}
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={h2}>New members by {grain}</h2>
            <div className="flex flex-wrap gap-1 text-[12px]">
              {GRAINS.map((g) => (
                <Chip key={g} href={qs({ grain: g })} active={grain === g} label={g[0].toUpperCase() + g.slice(1)} />
              ))}
            </div>
          </div>
          {buckets.length > 400 ? (
            <p className="text-[12px] text-[#6a7da0]">That&apos;s {buckets.length} {grain}s; pick a longer grouping or a shorter range.</p>
          ) : (
            <BarChart items={buckets.map((b) => ({ label: b.label, value: b.count }))} />
          )}
          <p className="mb-0 mt-2 text-[11px] text-[#6a7da0]">
            Counted on the day a member became Active in HubSpot. Hover a bar for its exact count.
          </p>
        </section>

        {/* Time to engage */}
        <section className={card}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={h2}>From joining to first engagement</h2>
            <span className="text-[11px] text-[#6a7da0]">
              members who joined {preset ? rangeLabel.toLowerCase() : `between ${rangeLabel}`}
            </span>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="mr-1 text-[#9bb0d4]">Counts as engaging:</span>
            {CHANNELS.map((c) => (
              <Chip key={c.key} href={toggleChannel(c.key)} active={channels.includes(c.key)} label={c.label} />
            ))}
          </div>
          {!computedAt ? (
            <p className="text-[12px] text-[#facc15]">
              First-engagement dates are being calculated for the first time (hourly, at 20 past). Check back shortly.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-[12px] text-[#9bb0d4]">How long it took</div>
                <BarChart items={bands} color="#a78bfa" height={160} />
              </div>
              <div>
                <div className="mb-2 text-[12px] text-[#9bb0d4]">Share engaging within 30 days, by when they joined</div>
                {cohorts.length > 1 ? (
                  <LineChart labels={cohorts.map((c) => c.label)} yMax={100} series={[{ label: "Within 30 days", color: "#22c55e", points: cohorts.map((c) => c.pct as number) }]} />
                ) : (
                  <p className="text-[12px] text-[#6a7da0]">Needs at least two groups of members who joined 30+ days ago.</p>
                )}
              </div>
            </div>
          )}
          <p className="mb-0 mt-3 text-[11px] text-[#6a7da0]">
            Engagement means: {definition}. Untick or tick above to try other definitions. Only activity on or after the
            day someone joined counts. Activity history starts in early 2026 (events from February, Slack and Circle
            from April), so members who joined before then look less engaged than they were.
          </p>
        </section>

        {/* Recent joiners */}
        <section className={card}>
          <h2 className={`${h2} mb-3`}>Most recent joiners</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[#6a7da0]">
                  <th className="py-2 font-medium">Member</th>
                  <th className="py-2 font-medium">City</th>
                  <th className="py-2 font-medium">Joined</th>
                  <th className="py-2 font-medium">First engaged</th>
                  <th className="py-2 font-medium">Days</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(({ m, at, days: d }) => (
                  <tr key={`${m.efId ?? m.name}-${m.joinedAt}`} className="border-t border-[#141c2b]">
                    <td className="py-2">
                      {m.efId ? (
                        <Link prefetch={false} href={`/engagement/${encodeURIComponent("c:" + m.efId)}`} className="text-[#cfdaee] hover:text-[#8ab4ff] hover:underline">{m.name}</Link>
                      ) : (
                        <span className="text-[#cfdaee]">{m.name}</span>
                      )}
                    </td>
                    <td className="py-2 text-[#9bb0d4]">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: TERRITORY_COLOR[m.region] }} />
                      {m.city ?? ""}
                    </td>
                    <td className="py-2 tabular-nums text-[#9bb0d4]">{m.joinedAt.slice(0, 10)}</td>
                    <td className="py-2 text-[#9bb0d4]">
                      {at ? `${at.slice(0, 10)} · ${CHANNEL_SHORT[engagedVia(m, channels, at) ?? "post"]}` : <span className="text-[#fb923c]">not yet</span>}
                    </td>
                    <td className="py-2 tabular-nums text-white">{d ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-white">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-[#6a7da0]">{sub}</div>}
    </div>
  );
}
