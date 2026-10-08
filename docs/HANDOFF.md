# MEQ handoff

**Last updated:** 2026-10-08. Keep this file current when the system changes; it replaces the June `MEQ-Handoff.md`.

## What MEQ is

**MEQ = Member Engagement and Quality**, an internal app for Confide Group / The CISO Society. It pulls member data from EventFlow, Slackle (Slack/Circle) and HubSpot, and turns it into engagement and quality scores that drive community-manager outreach.

- Live: https://meq.confide.group (Google sign-in, `@confide.group` only)
- Repo: https://github.com/Jarrod-Confide/MEQ. On Jarrod's MacBook: `/Users/jl/Claude/meq/app` (the `app/` folder is the git root).
- Hosting: Vercel project `confide/meq`. **Every push to `main` deploys to production.** Never run `vercel --prod`.

## Quick start

```bash
cd /Users/jl/Claude/meq/app
export PATH="/opt/homebrew/bin:$PATH"   # Homebrew node isn't on PATH in non-login shells
npm install
vercel env pull .env.local               # secrets come from Vercel; never hand-edit or paste them
npm run dev                              # http://localhost:3000
npm test                                 # unit tests (also run by every build)
```

## Environment variables

| Name | What it is |
|---|---|
| `DATABASE_URL` | **EventFlow's** Supabase (roster, events, attendance). Shared with the EventFlow app: rotating its password breaks MEQ too. |
| `SLACKLE_DATABASE_URL` | Slackle's Supabase (Slack/Circle messages, reactions) |
| `MEQ_DATABASE_URL` | MEQ's own Supabase, transaction pooler (6543). Everything MEQ writes lives here. |
| `MEQ_DIRECT_URL` | MEQ session pooler (5432), used only by drizzle-kit migrations |
| `AUTH_SECRET`, `AUTH_TRUST_HOST`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Sign-in |
| `CRON_SECRET` | Bearer token for `/api/cron/*` |
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot (quality, email clicks, referrer field) |
| `ANTHROPIC_API_KEY` | Claude Haiku scores message substance |
| `MEQ_TOKEN_EVENTFLOW` | Bearer EventFlow uses to call `/api/v1/member-stats` |
| `SLACK_ALERT_WEBHOOK` | Incoming webhook to #system-status for cron and page-error alerts. Alerts are silent until it's set. |

**Rotating a secret:** set it in Vercel for the **Production** scope, then push a commit. The Redeploy button reuses the old environment snapshot and will not pick up the change.

## Pages

Navigation is a sidebar (`src/components/Sidebar.tsx`, rendered by the root layout for signed-in users); on phones it collapses to a menu button and drawer.

| Route | What |
|---|---|
| `/` | **Dashboard**: goals at a glance (event attendance, new members in expansion cities, member engagement), each as goal and stretch, this quarter and year; trends; this quarter's events; needs-attention count. Opens on the signed-in CM's region(s); `?region=all\|NE\|…` |
| `/events` | Every event type, upcoming and held, by period and region: registrations so far and attendance against goal |
| `/outreach` | **My Priorities** (CM worklists, CSV export) |
| `/engagement`, `/engagement/[key]` | **Members**: leaderboard and member profile |
| `/quality` | Quality scores (linked from Members) |
| `/territory` | **Regions**: comparison across the five regions |
| `/territory/[region]` | One region: stats, hotspot map (4-week city trend), sortable member table |
| `/territory/map` | US map coloured by region |
| `/map` | Member map (bubbles by closest major city) |
| `/dashboard` | Membership overview (joins, tiers, composition) |
| `/admin` | **Admin** (admins only): Setup, Expansion cities, Staff & referrals, Admins, Unmatched cities |
| `/api/health` | Public health check for Confide Heartbeat (see Monitoring) |
| `/api/v1/member-stats` | Per-member tier, Slack activity, referrals and region for EventFlow (bearer `MEQ_TOKEN_EVENTFLOW`) |

## Regions

Five regions, assigned by the member's home state (`src/lib/territory.ts`):

| Code | Name | CM |
|---|---|---|
| `NE` | Northeast | Anjelica Orsini |
| `CENTRAL` | Central (includes Michigan since 2026-08-31) | Brandy Hardy |
| `WEST` | West (includes AK, HI, and Canada's BC and AB) | Madi Vorbrich |
| `SE` | Southeast | Sean Navarro |
| `OTHER` | **Global**: everyone else (international, rest of Canada, unmapped cities) | Sean Navarro |

- **Global's code is permanently `OTHER`.** That value is stored in snapshot history and in EventFlow's database (mirrored from member-stats). Never rename it; change only the label.
- CMs are assigned in `/admin/staff`; a person can manage several regions. The names in `TERRITORY_CM` are only a fallback.
- **EventFlow keeps its own copy of the region model** (`eventflow/src/lib/events/regions.ts`, with tests, plus Slack mentions in `src/lib/notifications/needs-attention.ts`). Any region or CM change must be made in both repos.
- The map's colours are baked into `public/regions-us-states.geojson`. If you move a state, update that file too; a test fails if the two disagree.

## Performance goals

MEQ tracks performance toward goals; it calculates no bonus (decided 2026-10-08). Rules live in `src/lib/performance.ts` (pure, tested); data in `src/lib/goals-data.ts`.

- **Every goal is a range:** goal and stretch.
- **Event attendance:** active practitioners (not sponsors, vendors or Confide staff) who attended. Each event's goal comes from its type's rule in Setup: by city size (tiers on members in the event's city that day), fixed, or none. Virtual types (EventFlow `invite_mode = 'gcal_broadcast'`) are counted, never given a goal. EventFlow city spellings that differ from members' Closest Major City are in `EVENT_CITY_ALIASES`.
- **New members in expansion cities:** members whose Closest Major City is an expansion city, counted by `joined_at` (becoming Active in HubSpot). Cities, regions and quarterly/annual goals at `/admin/cities`.
- **Member engagement:** share of members who attended an event (virtual counts unless Setup turns it off) or posted/replied on Slack or Circle in the Setup window. The trend comes from weekly snapshots' `signals` (90-day window).
- **Setup variables** are stored in `app_settings` (defaults in `performance.ts`). **Admins:** `admins` table plus the permanent `BOOTSTRAP_ADMINS` in `src/lib/viewer.ts` (and `MEQ_ADMIN_EMAILS`).
- **Who is signed in:** `staff.email` links a Google sign-in to a staff record and its regions.

## Engagement

`src/lib/engagement.ts`, `computeEngagement`. Seven dimensions:

`Events 0.30 · Contribution 0.18 · Reciprocity 0.15 · Depth 0.12 · Reach 0.10 · Connector 0.10 · Presence 0.05`

- **Virtual events count at a lower weight** than in-person: `WEIGHTS.attended` × Setup's `scoring.virtualEventPct` (default 50%), read from `app_settings` by the refresh cron. Counted separately as `signals.virtualAttended`; virtual no-shows cost nothing.
- Connector includes **member referrals** (from HubSpot's "Referred/Invited By" field), each worth more than any single connector post. 90-day decay throughout; dimensions normalized to the 95th-percentile member; tiers by rank percentile.
- **Staff referrals earn nothing.** The staff list must contain *everyone* at Confide who might refer members, not just CMs. Anyone missing from it gets member credit for their referrals.
- Referral matching rules (nicknames, emails, middle names, duplicates) live in `src/lib/referral-matching.ts`.

### Materialized, never computed on page load

The leaderboard is computed by a cron every 10 minutes and stored in `engagement_cache`; pages only read the stored row. **Never call `computeEngagement` (or any query that fans out across the three databases) from a page render.** That pattern caused the recurring "MEQ locks up" outages until July 2026.

## Scheduled jobs (`vercel.json`)

| Schedule (UTC) | Route | What |
|---|---|---|
| every 10 min | `/api/cron/refresh-engagement` | Recompute and store the leaderboard |
| 06:00 daily | `/api/cron/sync-members` | Roster from EventFlow, HubSpot quality, referral resolution |
| 06:30 daily | `/api/cron/score-messages` | Score new Slack/Circle messages with Haiku |
| 07:00 Mondays | `/api/cron/snapshot` | Weekly engagement snapshot (powers trends) |

Run one by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://meq.confide.group/api/cron/sync-members`

## Monitoring

- **Confide Heartbeat** polls `/api/health` every minute and posts to #system-status when it changes. Health returns 503 if any database is unreachable **or** data is stale: engagement older than 45 minutes, no successful sync in 26 hours, or no snapshot in 8 days (`src/lib/freshness.ts`). A cron that silently stops running shows up there.
- Cron failures and page errors also post to #system-status via `SLACK_ALERT_WEBHOOK`, once it is set.

## Database

MEQ's own tables (`src/lib/db/schema.ts`): `members`, `member_quality`, `message_scores`, `member_engagement_snapshots`, `member_sync_runs`, `staff`, `member_referrals`, `engagement_cache`, `admins`, `app_settings`, `expansion_cities`.

**Always migrate with `npm run db:migrate`**, which also enables row-level security on new tables. Deploy order matters: a migration that *adds* a column the code needs runs **before** the deploy; one that *drops* a column runs **after** the code stops using it.

## Tests

`npm test` runs Vitest (`src/**/*.test.ts`); `npm run build` runs it first, so a failing test blocks the deploy. Covered: the region model and its map, referral matching (including the staff-wins rule), scoring weights, quality and email tiers, and the health-check freshness rules. Tests never touch a database.

## Gotchas learned the hard way

1. **Never put a JavaScript `Date` inside a raw `sql` template.** postgres-js throws a `Buffer.byteLength` error. Pass `.toISOString()`.
2. **Keep page query batches small.** Database pools are `max: 5`; a single `Promise.all` of 10+ queries wedged the pool and hung `/dashboard`. Fetch in waves of four or fewer.
3. **`prefetch={false}` on nav and table links.** Next.js prefetching rendered every visible member profile in the background and saturated the database poolers.
4. **Bump `ENGAGEMENT_CACHE_VERSION`** whenever the shape of the engagement result changes; Vercel's data cache survives deploys.
5. **Map tiles are OpenStreetMap**, dark-toned by CSS. CARTO's tiles now need an API key.
6. **A HubSpot merge doesn't merge EventFlow's copies.** EventFlow combines its two records automatically when HubSpot reports a merge; for older merges run EventFlow's `scripts/merge-hubspot-merged-locals.ts` (dry run first). MEQ follows at its next sync, since it skips retired (`deleted_at`) contacts.

## Backlog

The working backlog is **`docs/BACKLOG.md`** (from the CM team's feedback, October 2026). Older ideas not yet in it:

- Merge Patrick Doliny's three HubSpot contacts (the duplicate cleanup of October 2026 left only that one).
- Have EventFlow take each region's CM from MEQ's member-stats feed instead of keeping its own copy.
- Member-facing score and gamification (quarterly email with tier and how to raise it).
- Vendor/sponsor flag from `member_quality.industry`.
- `src/lib/goals.ts` (placeholder targets used by the region pages) predates the performance goals; retire it when the region pages move to `performance.ts`.
