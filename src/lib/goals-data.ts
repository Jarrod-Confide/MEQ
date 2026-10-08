import { unstable_cache } from "next/cache";
import { eventflowSql } from "./db";
import { meqDb, meqSql, schema } from "./db/meq";
import { getEngagement } from "./engagement-cache";
import { getSettings } from "./settings";
import { safeIso } from "./safe-date";
import { territoryFromCity, type Territory } from "./territory";
import {
  eventGoal,
  eventRegion,
  inPeriod,
  isActivePractitioner,
  memberCitiesForEvent,
  participated,
  type GoalRange,
  type Period,
  type PerformanceSettings,
} from "./performance";

/**
 * Data behind the performance goals (Dashboard, Events). Raw facts are cached
 * for 10 minutes; goals are applied afterwards so a Setup change shows at
 * once. Each cached loader is one or two cheap queries, never the engagement
 * fan-out (that stays in the refresh cron).
 */

const TEN_MIN = 600;
export const GOALS_TAG = "goals";

// ─── Members (roster facts shared by several goals) ────────────────────────

type RosterRow = { city: string | null; region: Territory; joinedAt: string | null; efId: string | null };

const getRoster = unstable_cache(
  async (): Promise<RosterRow[]> => {
    const rows = await meqSql<{ city: string | null; joined_at: Date | null; ef: string | null }[]>`
      SELECT closest_major_city AS city, joined_at, eventflow_contact_id AS ef
      FROM members WHERE is_member`;
    return rows.map((r) => ({
      city: r.city,
      region: territoryFromCity(r.city),
      joinedAt: safeIso(r.joined_at),
      efId: r.ef,
    }));
  },
  ["goals-roster-v1"],
  { revalidate: TEN_MIN, tags: [GOALS_TAG] }
);

/** Members in the given cities who had joined by `at`. */
function membersInCities(roster: RosterRow[], cities: string[], at: string): number {
  if (!cities.length) return 0;
  const set = new Set(cities);
  const t = new Date(at).getTime();
  let n = 0;
  for (const r of roster) {
    if (r.city && set.has(r.city) && (!r.joinedAt || new Date(r.joinedAt).getTime() <= t)) n++;
  }
  return n;
}

// ─── Events ────────────────────────────────────────────────────────────────

type RawEvent = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  startsAt: string;
  status: string;
  capacity: number | null;
  typeSlug: string | null;
  typeName: string | null;
  isVirtual: boolean;
  isAddon: boolean;
  attended: number;
  practitioners: number;
  practitionerMembers: number;
  noShows: number;
  registered: number; // practitioners currently registered (upcoming events)
  waitlisted: number;
};

/** Events since 1 January last year (none exist before Feb 2026). */
const getRawEvents = unstable_cache(
  async (): Promise<RawEvent[]> => {
    const since = new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1)).toISOString();
    const [events, rows] = await Promise.all([
      eventflowSql<
        {
          id: string;
          display_name: string;
          city: string | null;
          state: string | null;
          starts_at: Date;
          status: string;
          capacity: number | null;
          slug: string | null;
          type_name: string | null;
          is_virtual: boolean;
          is_addon: boolean;
        }[]
      >`SELECT e.id, e.display_name, e.city, e.state, e.starts_at, e.status::text AS status, e.capacity,
               t.slug, t.name AS type_name,
               COALESCE(t.invite_mode = 'gcal_broadcast', false) AS is_virtual,
               COALESCE(t.is_addon_type, false) AS is_addon
        FROM events e LEFT JOIN event_types t ON t.id = e.event_type_id
        WHERE NOT e.is_test AND e.status NOT IN ('draft', 'cancelled') AND e.starts_at >= ${since}`,
      eventflowSql<
        {
          event_id: string;
          status: string;
          is_member: boolean;
          hubspot_sponsor: boolean;
          roles: string[] | null;
          email: string | null;
        }[]
      >`SELECT a.event_id, a.status::text AS status, c.is_member, c.hubspot_sponsor,
               c.contact_roles AS roles, lower(c.email) AS email
        FROM attendees a
        JOIN events e ON e.id = a.event_id
        JOIN contacts c ON c.id = a.contact_id
        WHERE NOT e.is_test AND e.starts_at >= ${since}
          AND a.status IN ('attended', 'no_show', 'registered', 'confirmed', 'tentative', 'waitlisted')`,
    ]);

    const agg = new Map<string, Omit<RawEvent, "id" | "name" | "city" | "state" | "startsAt" | "status" | "capacity" | "typeSlug" | "typeName" | "isVirtual" | "isAddon">>();
    for (const r of rows) {
      let a = agg.get(r.event_id);
      if (!a) {
        a = { attended: 0, practitioners: 0, practitionerMembers: 0, noShows: 0, registered: 0, waitlisted: 0 };
        agg.set(r.event_id, a);
      }
      const practitioner = isActivePractitioner({
        email: r.email,
        hubspotSponsor: !!r.hubspot_sponsor,
        roles: r.roles ?? [],
      });
      if (r.status === "attended") {
        a.attended++;
        if (practitioner) {
          a.practitioners++;
          if (r.is_member) a.practitionerMembers++;
        }
      } else if (r.status === "no_show") {
        a.noShows++;
      } else if (r.status === "waitlisted") {
        a.waitlisted++;
      } else if (practitioner) {
        a.registered++;
      }
    }

    return events.map((e) => ({
      id: e.id,
      name: e.display_name,
      city: e.city?.trim() || null,
      state: e.state,
      startsAt: safeIso(e.starts_at) ?? new Date(0).toISOString(),
      status: e.status,
      capacity: e.capacity,
      typeSlug: e.slug,
      typeName: e.type_name,
      isVirtual: e.is_virtual,
      isAddon: e.is_addon,
      ...(agg.get(e.id) ?? { attended: 0, practitioners: 0, practitionerMembers: 0, noShows: 0, registered: 0, waitlisted: 0 }),
    }));
  },
  ["goals-events-v1"],
  { revalidate: TEN_MIN, tags: [GOALS_TAG] }
);

export type EventRow = RawEvent & {
  region: Territory;
  past: boolean;
  membersInCity: number;
  goal: GoalRange | null;
};

export async function getEvents(): Promise<{ events: EventRow[]; settings: PerformanceSettings }> {
  const [raw, roster, settings] = await Promise.all([getRawEvents(), getRoster(), getSettings()]);
  const now = Date.now();
  const events = raw
    .map((e) => {
      const membersInCity = e.isVirtual ? 0 : membersInCities(roster, memberCitiesForEvent(e.city), e.startsAt);
      return {
        ...e,
        region: e.isVirtual ? ("OTHER" as Territory) : eventRegion(e.city, e.state),
        past: new Date(e.startsAt).getTime() < now,
        membersInCity,
        goal: e.isVirtual ? null : eventGoal(e.typeSlug, membersInCity, settings),
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { events, settings };
}

/** In-person events count toward a region; virtual events belong to everyone. */
export function eventsInScope(events: EventRow[], regions: Territory[] | "ALL"): EventRow[] {
  if (regions === "ALL") return events;
  return events.filter((e) => !e.isVirtual && regions.includes(e.region));
}

export type AttendanceRollup = {
  events: number; // past events with a goal
  actual: number; // active practitioners who attended them
  goal: number;
  stretch: number;
  metGoal: number; // events that reached their goal
  metStretch: number;
};

/** Attendance goal progress for past events in a period. */
export function rollupAttendance(events: EventRow[], p: Period): AttendanceRollup {
  const out: AttendanceRollup = { events: 0, actual: 0, goal: 0, stretch: 0, metGoal: 0, metStretch: 0 };
  for (const e of events) {
    if (!e.goal || !e.past || !inPeriod(e.startsAt, p)) continue;
    out.events++;
    out.actual += e.practitioners;
    out.goal += e.goal.goal;
    out.stretch += e.goal.stretch;
    if (e.practitioners >= e.goal.goal) out.metGoal++;
    if (e.practitioners >= e.goal.stretch) out.metStretch++;
  }
  return out;
}

// ─── Expansion cities ──────────────────────────────────────────────────────

export type ExpansionCityProgress = {
  id: string;
  city: string;
  region: Territory;
  active: boolean;
  quarter: GoalRange & { actual: number };
  year: GoalRange & { actual: number };
  /** New members per quarter, oldest first (aligned with `quarters`). */
  byQuarter: number[];
  totalMembers: number;
};

export async function getExpansionProgress(quarter: Period, year: Period, quarters: Period[]) {
  const [cities, roster] = await Promise.all([
    unstable_cache(
      () => meqDb.select().from(schema.expansionCities).orderBy(schema.expansionCities.city),
      ["goals-expansion-cities-v1"],
      { revalidate: TEN_MIN, tags: [GOALS_TAG] }
    )(),
    getRoster(),
  ]);
  return cities.map((c): ExpansionCityProgress => {
    const joins = roster.filter((r) => r.city === c.city && r.joinedAt).map((r) => r.joinedAt as string);
    return {
      id: c.id,
      city: c.city,
      region: c.region as Territory,
      active: c.active,
      quarter: { goal: c.quarterGoal, stretch: c.quarterStretch, actual: joins.filter((j) => inPeriod(j, quarter)).length },
      year: { goal: c.yearGoal, stretch: c.yearStretch, actual: joins.filter((j) => inPeriod(j, year)).length },
      byQuarter: quarters.map((q) => joins.filter((j) => inPeriod(j, q)).length),
      totalMembers: roster.filter((r) => r.city === c.city).length,
    };
  });
}

// ─── Member engagement (participation share) ───────────────────────────────

export type EngagementShare = {
  members: number;
  participating: number;
  pct: number | null;
  windowDays: number;
};

/** Share of a scope's members who participated in the Setup window, now. */
export async function getEngagementShare(regions: Territory[] | "ALL"): Promise<EngagementShare> {
  const settings = await getSettings();
  const measure = settings.engagement;
  const [eng, roster] = await Promise.all([getEngagement(measure.windowDays), getRoster()]);
  const signalsByEf = new Map<string, (typeof eng.members)[number]["signals"]>();
  for (const m of eng.members) if (m.key.startsWith("c:")) signalsByEf.set(m.key.slice(2), m.signals);
  let members = 0;
  let participating = 0;
  for (const r of roster) {
    if (regions !== "ALL" && !regions.includes(r.region)) continue;
    members++;
    if (r.efId && participated(signalsByEf.get(r.efId), measure)) participating++;
  }
  return {
    members,
    participating,
    pct: members ? Math.round((participating / members) * 1000) / 10 : null,
    windowDays: measure.windowDays,
  };
}

export type SharePoint = { week: string; pct: number };

/**
 * Weekly participation share from snapshots (always a 90-day window). Weeks
 * written before snapshots stored signals are skipped. The SQL predicate
 * mirrors participated() in performance.ts: keep the two in step.
 */
export async function getEngagementShareTrend(regions: Territory[] | "ALL"): Promise<SharePoint[]> {
  const settings = await getSettings();
  const { countReactions, countVirtual } = settings.engagement;
  const [rows, roster] = await Promise.all([
    unstable_cache(
      async () =>
        (
          await meqSql<{ week_start: Date; territory: string | null; participated: number; missing: number }[]>`
            SELECT week_start, territory,
              COUNT(*) FILTER (WHERE
                COALESCE((signals->>'eventsAttended')::int, 0) > 0
                OR (${countVirtual} AND COALESCE((signals->>'virtualAttended')::int, 0) > 0)
                OR COALESCE((signals->>'posts')::int, 0) + COALESCE((signals->>'replies')::int, 0) > 0
                OR (${countReactions} AND COALESCE((signals->>'reactionsGiven')::int, 0) > 0)
              )::int AS participated,
              COUNT(*) FILTER (WHERE signals IS NULL)::int AS missing
            FROM member_engagement_snapshots
            WHERE is_member AND member_id IS NOT NULL
              AND week_start >= NOW() - INTERVAL '400 days'
            GROUP BY 1, 2 ORDER BY 1`
        ).map((r) => ({ ...r, week_start: safeIso(r.week_start) ?? "" })),
      ["goals-share-trend-v2", String(countReactions), String(countVirtual)],
      { revalidate: TEN_MIN, tags: [GOALS_TAG] }
    )(),
    getRoster(),
  ]);

  const byWeek = new Map<string, { participated: number; missing: number }>();
  for (const r of rows) {
    if (regions !== "ALL" && !regions.includes((r.territory ?? "OTHER") as Territory)) continue;
    const w = byWeek.get(r.week_start) ?? { participated: 0, missing: 0 };
    w.participated += r.participated;
    w.missing += r.missing;
    byWeek.set(r.week_start, w);
  }
  const out: SharePoint[] = [];
  for (const [week, w] of [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (w.missing > 0) continue;
    const end = new Date(week).getTime() + 7 * 86400000;
    const members = roster.filter(
      (r) => (regions === "ALL" || regions.includes(r.region)) && (!r.joinedAt || new Date(r.joinedAt).getTime() < end)
    ).length;
    if (members) out.push({ week: week.slice(0, 10), pct: Math.round((w.participated / members) * 1000) / 10 });
  }
  return out;
}

// ─── Event types (for Setup) ───────────────────────────────────────────────

export type EventTypeInfo = { slug: string; name: string; isVirtual: boolean; isAddon: boolean; events: number };

export const getEventTypes = unstable_cache(
  async (): Promise<EventTypeInfo[]> => {
    const rows = await eventflowSql<{ slug: string; name: string; is_virtual: boolean; is_addon: boolean; events: number }[]>`
      SELECT t.slug, t.name, COALESCE(t.invite_mode = 'gcal_broadcast', false) AS is_virtual,
             COALESCE(t.is_addon_type, false) AS is_addon,
             COUNT(e.id) FILTER (WHERE NOT e.is_test)::int AS events
      FROM event_types t LEFT JOIN events e ON e.event_type_id = t.id
      GROUP BY t.id ORDER BY events DESC, t.name`;
    return rows.map((r) => ({ slug: r.slug, name: r.name, isVirtual: r.is_virtual, isAddon: r.is_addon, events: r.events }));
  },
  ["goals-event-types-v1"],
  { revalidate: TEN_MIN, tags: [GOALS_TAG] }
);
