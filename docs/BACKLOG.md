# MEQ backlog

**Source:** "MEQ Community Manager Feedback" (CM team, Oct 2026), reviewed against the live system and data on 2026-10-06.
**Theme from the team:** make MEQ something CMs *act* on every day, not just a place to look at data.

Sizes: **S** = under a day, **M** = a few days, **L** = a week or more. Priority: **P1** do first, **P2** next, **P3** nice to have.

---

## What the review found

These change how some requests should be built:

1. **Virtual events already count in engagement, at full dinner weight.** EventFlow syncs Zoom attendance into the same "attended" status MEQ scores, and the Events dimension treats every attendance the same. In the last 90 days that was **615 virtual attendances vs 180 in person**, so most of what the Events score measures today is virtual. The request "include virtual events" is really "score virtual and in-person *separately*" (MQ-7).
2. **Slack and Circle can be told apart** (Slackle tags each message with its source), but Circle is small: about 290 native Circle messages since April vs about 9,700 from Slack.
3. **Nothing records Circle logins.** HubSpot has a yes/no `circle_active` flag and the Circle member ID (100% filled), not a login date. A login date would have to come from Circle's own API (MQ-11).
4. **New-member funnel data is partly there.** `date_joined` is 100% filled. `application_date` is 70% filled for recent joiners (21% overall). There is **no "Onboarded" field** anywhere (MQ-12).
5. **Exact location exists for under half of members, and none of the new ones.** HubSpot's real `city` is filled for 44% of members but **0% of the 64 who joined in the last 90 days**: the onboarding form doesn't ask for it. Where we do have it, **701 members live somewhere other than their "closest major city"** (Mission Viejo → Los Angeles, Skillman → New York City), which confirms the team's Waco/Austin concern.
6. **Personalization needs to know which CM is signed in.** Sign-in is Google, but the staff list has no email addresses, so MEQ can't yet tell that Anjelica is looking at it. Several items (a CM-focused dashboard, "My Priorities") depend on that link (MQ-3).
7. **Scoring changes reset comparisons.** Any change to how engagement is weighted shifts every score, so trend charts will show a step at that week. Each scoring change should be annotated on the charts and announced to CMs.

---

## Proposed navigation

Today: Map · Dashboard · Engagement · Quality · Quadrant · Regions · Outreach · Staff.

Proposed: **Dashboard** (landing page) · **My Priorities** · **Members** · **New Members** · **Regions** (map inside) · **Admin** (staff, referrals, data quality).

Engagement, Quality and Quadrant merge into **Members**. Map moves under **Regions**. Staff & Referrals moves under **Admin**.

---

## Backlog

### Foundation (P1)

**MQ-1 · New navigation, Dashboard as the landing page** · S · P1
- Request: simplify navigation; make the Dashboard the default page.
- Build: the nav above; `/` opens the Dashboard; old routes redirect (Engagement, Quality and Quadrant to Members; Outreach to My Priorities; Map to Regions) so bookmarks keep working.
- Depends on: MQ-4 and MQ-5 for the pages the old ones redirect to (redirect to the closest existing page until then).

**MQ-2 · Admin area** · S · P1
- Request: move Staff & Referrals out of the main navigation.
- Build: an Admin page holding Staff & Referrals, unmatched cities (`/admin/unmatched`), and data-quality checks (duplicate contacts, missing cities). Out of the main nav; linked from the header.

**MQ-3 · Know which CM is signed in** · S · P1 · *enabler*
- Why: needed for a CM-focused Dashboard (MQ-6) and My Priorities (MQ-5).
- Build: add each staff member's sign-in email to the staff list; on sign-in, match the Google email to staff. CMs default to their own region(s) everywhere, with a switch to see all. Non-CM staff (Jarrod, Jason, …) default to all regions.

### Members & engagement

**MQ-4 · Members page (replaces Engagement, Quality, Quadrant)** · L · P1
- Request: one Members view, filterable by engagement, quality, region, company, seniority, member since, and more.
- Build: one table of every member with filters (region, CM, engagement tier and score range, quality tier, company, seniority, member-since range, channel activity once MQ-8 lands), sortable columns, saved filter presets, CSV export. The quadrant chart becomes an optional view of the same filtered set, not a separate page. Member profiles stay as they are.
- Data: all available today.

**MQ-5 · My Priorities (replaces Outreach)** · M · P1
- Request: a list of members each CM should actually pay attention to.
- Build: the signed-in CM's own region by default (MQ-3), grouped as: new members who haven't activated, previously engaged members who are declining, dormant members, high-quality members with low engagement. These segments exist in Outreach today; this makes them personal and ranked.
- **Suggested addition:** let a CM mark a member *contacted* or *snoozed* with a short note, so lists don't repeat the same names every day and the team can see follow-up. This is what makes the page actionable rather than another view of data. Needs a small new table.
- Open question: which definition of "activated" (see MQ-12).

**MQ-6 · CM-focused Dashboard** · M · P1
- Request: focus the Dashboard on what CMs need most.
- Build: for the signed-in CM's region, a few headline numbers with change vs last month (members, new members, engaged share, average engagement), the top of My Priorities, new-member activation, and Top Cities insights (MQ-15). The current org-wide dashboard stays available as "All regions".
- Open question: the team should pick the 4 to 6 numbers that matter most.

**MQ-7 · Score virtual and in-person events separately** · S (code) · P1 · *needs a decision*
- Request: include virtual events in engagement scoring.
- Reality: they are already included, at full dinner weight (see finding 1).
- Build: split the Events dimension into **In-person events** and **Virtual events**, each with its own weight. Bump the cache version and annotate the trend charts.
- Decision for the team: how much is one virtual attendance worth relative to a dinner? (Example: a dinner counts 50, a virtual session 20.)

**MQ-8 · Engagement by channel: Slack, Circle, virtual, in-person** · M · P2
- Request: break engagement down by channel instead of one overall score.
- Build: per-member sub-scores for Slack activity, Circle activity, virtual events, and in-person events, shown on the profile, as columns and filters on Members, and as region roll-ups. The overall score stays for ranking.
- Data: available (message source, Zoom-linked events). Circle volume is low today, so the Circle column will mostly be empty until Circle use grows.

**MQ-9 · Don't penalize members who live far from events** · M · P2 · *needs a decision*
- Request: members shouldn't lose engagement because we host nothing near them.
- Options:
  - **(a) Opportunity-adjusted (recommended):** score in-person events as "attended out of invited". EventFlow records every invitation, so a member never invited to a dinner isn't marked down for missing one.
  - (b) Lower the in-person weight overall.
  - (c) Drop in-person events from the overall score and show them only as their own channel (MQ-8).
- With MQ-7 splitting out virtual, members far from dinners can still score well on virtual events.

### New members

**MQ-10 · New Members page with a funnel** · L · P2
- Request: see what happens after someone joins, as a funnel by CM: Applied → Onboarded → Circle login → last activity → attended an event.
- Build: a New Members page (default last 90 days, filterable by region/CM) with the funnel per member and per cohort, plus conversion and time between steps. Compare CMs and regions.
- Data per step:

| Step | Source | Status |
|---|---|---|
| Applied | HubSpot `application_date` | 70% filled for recent joiners |
| Joined / accepted | HubSpot `date_joined` | 100% |
| Onboarded | none | needs a definition (MQ-12) |
| Circle login | none today | needs MQ-11 |
| Last activity | MEQ engagement | available |
| Attended an event | EventFlow attendance | available |
| Community manager | region → staff | available |

**MQ-11 · Spike: where can a Circle login date come from?** · S · P2
- Check whether Circle's admin API exposes a member's first and last login. CircleHub already talks to that API and could write the date to HubSpot, where MEQ would pick it up. Report back before MQ-10's Circle step is built.

**MQ-12 · Define "Onboarded" and "Activated"** · team decision · P1 (blocks MQ-5 and MQ-10)
- "Onboarded" has no field today. Is it a welcome call, the Circle account being created, a HubSpot status? Once defined, record it as a HubSpot date property.
- "Activated" (used by My Priorities and the funnel) needs one definition, e.g. *first Slack/Circle post or first event attended within 30 days of joining*.

### Regions

**MQ-13 · Regions over time** · M · P2
- Request: keep the regional view but focus on change over time: membership growth, engagement change, and new-member activation by region and CM.
- Build: trend charts per region from the weekly snapshots, plus membership growth from `date_joined`. Region is recomputed from each member's city rather than read from the snapshot, because snapshots before July carry the old quadrant codes. New-member activation per region follows MQ-12.

**MQ-14 · Map moves under Regions** · S · P2
- Request: keep the map, but not as the first page.
- Build: Map becomes a tab of Regions. Part of MQ-1.

**MQ-15 · Top Cities insights** · S · P2
- Request: show fastest growing, most engaged, and least engaged cities, probably on the Dashboard.
- Build: city rankings (growth from `date_joined`, average engagement, engaged share), shown on the Dashboard (MQ-6) and on Regions.

### Location (nice to have)

**MQ-16 · Use members' real city, not just the closest major city** · M · P3
- Request: place someone in Waco as Waco, not Austin.
- Reality: HubSpot's `city` is filled for 44% of members and 0% of new ones, and MEQ's geocoding knows only about 120 metros.
- Build: geocode HubSpot city + state (a bundled US-cities dataset, no paid service) and store each member's real location and distance to their closest major city. Show it on the map and profile. Still assign regions by state (unchanged).

**MQ-17 · Collect home city on the onboarding form** · S (form) · P3 · *outside MEQ*
- Request: ask for the city they live in, then the closest major city from a list.
- Owner: whoever runs the HubSpot onboarding form. Without it, MQ-16 can never cover new members.
- Follow-on for **EventFlow**: use the distance to avoid inviting members to dinners hours away. That is an EventFlow change, not MEQ.

---

## Open questions for the team

1. **Virtual vs in-person:** what should one virtual attendance be worth relative to a dinner? (MQ-7)
2. **Fairness for remote members:** opportunity-adjusted (recommended), a lower weight, or in-person shown separately only? (MQ-9)
3. **"Onboarded":** what event marks it, and who records it? (MQ-12)
4. **"Activated":** one definition for new members, e.g. a first post or event within 30 days. (MQ-12)
5. **Dashboard:** which 4 to 6 numbers matter most to a CM? (MQ-6)
6. **My Priorities:** do CMs want to mark members contacted or snoozed, with a note? (MQ-5)
7. **Quadrant chart:** keep it as a view inside Members, or retire it? (MQ-4)

---

## Suggested order

1. **Foundation and quick wins:** MQ-1, MQ-2, MQ-3, then MQ-7 once the weight is decided.
2. **Daily CM workflow:** MQ-4 Members, MQ-5 My Priorities, MQ-6 Dashboard.
3. **Scoring:** MQ-8 channels, MQ-9 remote fairness.
4. **New members:** MQ-12 decisions, MQ-11 spike, then MQ-10.
5. **Regions:** MQ-13, MQ-14, MQ-15.
6. **Location:** MQ-17 (form change, anytime), then MQ-16.
