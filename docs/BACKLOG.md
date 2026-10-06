# MEQ backlog

**Source:** "MEQ Community Manager Feedback" (CM team, Oct 2026), reviewed against the live system and data on 2026-10-06. Decisions from Jarrod recorded the same day.
**Theme from the team:** make MEQ something CMs *act* on every day, not just a place to look at data.

Sizes: **S** = under a day, **M** = a few days, **L** = a week or more. Priority: **P1** do first, **P2** next, **P3** nice to have.
Status: **Ready** (agreed, can be built) · **Decided** (approach chosen) · **Needs decision** · **Not planned**.

---

## Decisions (2026-10-06)

- **Navigation:** approved. Six tabs: Dashboard (landing) · My Priorities · Members · New Members · Regions (map inside) · Admin.
- **Virtual vs in-person:** scored separately with separate counts; in-person matters more than virtual. (MQ-7)
- **Members far from events:** opportunity-adjusted scoring, i.e. dinners attended out of dinners invited to. (MQ-9)
- **Circle logins:** capture them. (MQ-11)
- **Location:** stays the Closest Major City from the onboarding form; no exact-location work. (MQ-16, MQ-17 not planned)
- **Onboarded:** for now, when the member is marked Active in HubSpot; keep exploring a better definition. (MQ-12)
- **Activated:** answered as "marked Active in HubSpot", which needs a second look (MQ-12).

## What the review found

1. **Virtual events already count in engagement, at full dinner weight.** EventFlow syncs Zoom attendance into the same "attended" status MEQ scores. In the last 90 days that was **615 virtual attendances vs 180 in person**, so most of today's Events score is virtual. Fixed by MQ-7.
2. **Slack and Circle can be told apart** (Slackle tags each message's source), but Circle is small: about 290 Circle messages since April vs about 9,700 from Slack.
3. **Circle's API has login data.** Each Circle member record carries `accepted_invitation` (when they first joined Circle, i.e. first login), `last_seen_at` (most recent visit), `profile_confirmed_at`, and post and comment counts. CircleHub already reads these records; nothing stores the dates yet.
4. **New-member funnel data:** `date_joined` is 100% filled; `application_date` 70% for recent joiners (21% overall).
5. **MEQ's roster is exactly the members marked Active in HubSpot** (2,268). Pending, Prospect, Declined and other statuses are excluded. This matters for the Activated definition (MQ-12).
6. **Personalization needs to know which CM is signed in.** The staff list has no email addresses yet (MQ-3).
7. **Scoring changes reset comparisons.** Each change to weighting shifts every score, so trend charts show a step that week. Annotate the charts and tell the CMs.

---

## Backlog

### Foundation

**MQ-1 · New navigation, Dashboard as the landing page** · S · P1 · Ready
- Six tabs as decided; `/` opens the Dashboard. Old routes redirect (Engagement, Quality, Quadrant → Members; Outreach → My Priorities; Map → Regions; Staff → Admin) so bookmarks keep working.

**MQ-2 · Admin area** · S · P1 · Ready
- Staff & Referrals, unmatched cities, and data-quality checks (duplicate contacts, missing cities) move into Admin, out of the main nav.

**MQ-3 · Know which CM is signed in** · S · P1 · Ready · *enabler*
- Add each staff member's sign-in email to the staff list; match the Google sign-in to staff. CMs default to their own region(s) with a switch to see all; non-CM staff default to all regions. Needed by MQ-5 and MQ-6.

### Members & engagement

**MQ-4 · Members page (replaces Engagement, Quality, Quadrant)** · L · P1 · Ready
- One table of every member, filterable by region, CM, engagement tier and score, quality tier, company, seniority, member since, and channel activity (MQ-8). Sortable, saved filter presets, CSV export. The quadrant chart becomes an optional view of the same filtered set.
- Open: keep the quadrant chart, or retire it?

**MQ-5 · My Priorities (replaces Outreach)** · M · P1 · Needs decision
- The signed-in CM's region by default, grouped as: new members who haven't activated, previously engaged members who are declining, dormant members, high-quality members with low engagement.
- Suggested: let CMs mark a member *contacted* or *snoozed* with a note, so the list doesn't repeat the same names daily.
- Open: do CMs want contacted/snoozed? "Haven't activated" depends on MQ-12.

**MQ-6 · CM-focused Dashboard** · M · P1 · Needs decision
- For the signed-in CM's region: a few headline numbers with change vs last month, the top of My Priorities, new-member activation, Top Cities insights (MQ-15). "All regions" stays available.
- Open: which 4 to 6 numbers matter most to a CM?

**MQ-7 · Score in-person and virtual events separately** · S · P1 · Decided
- Split Events into **In-person events** and **Virtual events**, each with its own count and weight, in-person weighted well above virtual. Bump the cache version; annotate trend charts.
- To confirm when building: does virtual add a *small* amount to the overall score, or show as a count only? Proposed: small (for example in-person 0.26, virtual 0.06 of the total).

**MQ-8 · Engagement by channel: Slack, Circle, virtual, in-person** · M · P2 · Ready
- Per-member sub-scores shown on the profile, as Members columns and filters, and as region roll-ups. The overall score stays for ranking. Circle activity becomes richer once MQ-11 stores Circle's own post and comment counts and last visit.

**MQ-9 · Don't penalize members who live far from events** · M · P2 · Decided
- Opportunity-adjusted: score in-person events as attended out of invited (EventFlow records every invitation). A member never invited to a dinner isn't marked down for missing one.

### New members

**MQ-10 · New Members page with a funnel** · L · P2 · Ready (one step depends on MQ-12)
- Default last 90 days, filterable by region/CM, per member and per cohort, with conversion and time between steps; compare CMs.

| Step | Source | Status |
|---|---|---|
| Applied | HubSpot `application_date` | 70% filled for recent joiners |
| Onboarded (marked Active) | HubSpot `date_joined`, or the date membership status became Active | available |
| First Circle login | Circle `accepted_invitation` | after MQ-11 |
| Last Circle visit | Circle `last_seen_at` | after MQ-11 |
| Last activity | MEQ engagement | available |
| Attended an event | EventFlow attendance | available |
| Activated | per MQ-12 | needs decision |
| Community manager | region → staff | available |

**MQ-11 · Capture Circle logins** · M · P2 · Decided
- Spike done: Circle's member records include `accepted_invitation` (first login), `last_seen_at`, `profile_confirmed_at`, and post/comment counts.
- Recommended: CircleHub writes these to new HubSpot contact properties (first Circle login, last Circle visit, Circle posts/comments) on its daily run, the same way it already writes `circle_active` and `circle_member_id`. MEQ picks them up through its existing HubSpot sync, and EventFlow can use them too. (Alternative: MEQ reads Circle directly, which needs a Circle token in MEQ.)
- Worth doing early: the dates are current values, so capture can start any time and the funnel gains history from then on.

**MQ-12 · Define "Onboarded" and "Activated"** · P1 · Needs decision (blocks MQ-5 and MQ-10)
- **Onboarded:** for now, when the member is marked Active in HubSpot. Keep exploring a better definition.
- **Activated:** answered as "marked Active in HubSpot". But MEQ only includes members already marked Active, so by that definition every member in MEQ is activated, "new members who haven't activated" would always be empty, and the funnel would count the same event twice.
- **Proposed:** keep Onboarded = marked Active, and define **Activated = first real participation within 30 days of being marked Active**: a first Circle login, Slack/Circle post, or event attended. Needs confirmation.

### Regions

**MQ-13 · Regions over time** · M · P2 · Ready
- Trend charts per region and CM from the weekly snapshots: membership growth (from `date_joined`), engagement change, new-member activation (after MQ-12). Region is recomputed from each member's city, because snapshots before July carry the old quadrant codes.

**MQ-14 · Map under Regions** · S · P2 · Ready
- Map becomes a tab of Regions. Delivered with MQ-1.

**MQ-15 · Top Cities insights** · S · P2 · Ready
- Fastest growing, most engaged and least engaged cities, on the Dashboard (MQ-6) and Regions.

### Location

**MQ-16 · Members' real city** · Not planned
- Decision: location stays the Closest Major City from the onboarding form.

**MQ-17 · Ask for home city on the onboarding form** · Not planned
- Decision: the form's Closest Major City is what MEQ uses.

---

## Open questions

1. **Activated:** confirm the proposed definition (first participation within 30 days of being marked Active). (MQ-12)
2. **Onboarded:** a better definition than "marked Active", if one exists. (MQ-12)
3. **Virtual:** a small share of the overall score, or a count only? (MQ-7)
4. **Dashboard:** which 4 to 6 numbers matter most to a CM? (MQ-6)
5. **My Priorities:** do CMs want contacted/snoozed with a note? (MQ-5)
6. **Quadrant chart:** keep as a view inside Members, or retire? (MQ-4)

---

## Suggested order

1. **Foundation:** MQ-1, MQ-2, MQ-3, MQ-7. Start MQ-11 (Circle capture) early so login history builds up.
2. **Daily CM workflow:** MQ-4 Members, MQ-5 My Priorities, MQ-6 Dashboard.
3. **Scoring:** MQ-8 channels, MQ-9 opportunity-adjusted events.
4. **New members:** MQ-12 decisions, then MQ-10.
5. **Regions:** MQ-13, MQ-14, MQ-15.
