# MEQ backlog

**Sources:** "MEQ Community Manager Feedback" (CM team, Oct 2026) and the "Community Manager Performance & Bonus Plan v2" draft, reviewed against the live system and data. Decisions from Jarrod recorded 2026-10-06 and 2026-10-08.
**Theme:** make MEQ something CMs *act* on every day, centered on the goals they are measured against.

Sizes: **S** = under a day, **M** = a few days, **L** = a week or more. Priority: **P1** do first, **P2** next, **P3** nice to have.
Status: **Ready** (agreed, can be built) · **Decided** (approach chosen) · **Needs decision** · **Not planned**.

---

## Decisions

### 2026-10-08: performance goals, not bonus calculations

- **MEQ tracks performance toward goals. It does not calculate bonuses.** The bonus is decided at the end of the year on overall performance against the goals, outside MEQ. No bonus formula, weights, combined achievement score or dollar amounts appear in MEQ.
- **Why:** a single event's attendance isn't fully in the CM's control. A dinner can be full, and no amount of pushing adds seats. Goals are judged on overall performance, with that context visible.
- **Every CM is on the plan** and tracked against the same goals.
- **Goals are tracked per quarter and per year.**
- **Active practitioner:** attendees who are practicing security leaders. Everyone else is excluded (sponsors, vendors, Confide staff, guests).
- **Full events:** an event that reached capacity is marked *Full*, and its attendance goal is capped at its capacity, so a CM is never shown short for seats that didn't exist. (Proposed by MEQ; confirm.)
- **Southeast is getting a new CM**, starting soon. Once they start, Sean manages Global only (MQ-22).

### 2026-10-06

- **Navigation:** approved. Six tabs: Dashboard (landing) · My Priorities · Members · New Members · Regions (map inside) · Admin.
- **Events in the engagement score:** live (in-person) events only. Virtual attendance is measured and shown as its own count, but does **not** add to the overall score. (MQ-7)
- **Members far from events:** in-person events scored as attended out of invited. (MQ-9)
- **Circle logins:** capture them. (MQ-11)
- **Location:** stays the Closest Major City from the onboarding form. (MQ-16, MQ-17 not planned)
- **My Priorities:** CMs can log activity on a member (contacted, snoozed, notes, and other actions). (MQ-5)
- **Quadrant chart:** retired. (MQ-4)
- **Dashboard numbers:** the performance goals plus the CM's daily workload (MQ-6).
- **Membership lifecycle:** Prospect → Pending (asked to join) → Active (completed the onboarding form). What counts as "onboarded" stays open for the team. (MQ-12)

## The performance goals MEQ tracks

From the v2 plan, minus the bonus mechanics. Each is shown per quarter and per year, with a trend.

1. **Event attendance:** each Networking Dinner or Experience Event in the CM's region has a goal set by the number of members in that city: under 30 members → 10 attendees; 30 to 50 → 15; 50 to 100 → 20; 100+ → 25. It counts **actual attendance by active practitioners**, not registrations. Full events are capped at capacity.
2. **New members in expansion cities:** each CM has a short list of expansion cities, with a target of new qualified, onboarded members per city (the plan says 5). Anjie's are Columbus, Cleveland, Cincinnati, Providence and Philadelphia.
3. **Member engagement (from Q1 2027):** measured with MEQ; targets to be set (MQ-21).

None of this exists in any system today: EventFlow has no attendance goals, no "active practitioner" flag, and no expansion cities. MQ-18, MQ-19 and MQ-21 add them; MQ-20 shows them per quarter and per year.

### Anti-Summits (explained)

The **v1** plan gave each **Anti-Summit** (the larger flagship events) its own targets, separate from dinners: **50 total attendees, 12 qualified non-member attendees, and 6 new members** per Anti-Summit. The v2 draft dropped the separate non-member and new-member targets for dinners and left a note asking whether those Anti-Summit targets carry over. If they do, MEQ tracks them as a separate line under event attendance; if not, Anti-Summits are measured like any other event (or not at all).

## What the review found

1. **Virtual events already count in engagement, at full dinner weight.** In the last 90 days that was **615 virtual attendances vs 180 in person**. MQ-7 takes virtual out of the score.
2. **Engagement tiers are relative.** The top 10% are always Champions, so the share of "engaged" members across the organization stays fixed by construction and can't improve. An engagement goal needs an absolute measure (MQ-21).
3. **Circle's API has login data:** `accepted_invitation` (first login), `last_seen_at` (last visit), plus post and comment counts. CircleHub already reads these records; nothing stores them yet.
4. **Slack and Circle can be told apart**, but Circle is small: about 290 Circle messages since April vs 9,700 from Slack.
5. **MEQ's roster is only Active members** (2,268). Prospects (about 580) and Pending (about 15) live in EventFlow but not in MEQ, so the New Members funnel needs them added (MQ-10).
6. **Funnel dates:** `date_joined` is 100% filled; `application_date` 70% for recent joiners.
7. **MEQ doesn't yet know which CM is signed in** (MQ-3).
8. **Scoring changes reset comparisons.** Annotate the trend charts and tell the CMs whenever weights change.
9. **EventFlow already stores each event's capacity and a waitlist**, so MEQ can tell when an event was full.

---

## Backlog

### Foundation

**MQ-1 · New navigation, Dashboard as the landing page** · S · P1 · Ready
- Six tabs as approved; `/` opens the Dashboard. Old routes redirect (Engagement, Quality, Quadrant → Members; Outreach → My Priorities; Map → Regions; Staff → Admin).

**MQ-2 · Admin area** · S · P1 · Ready
- Staff & Referrals, expansion cities (MQ-18), unmatched cities, and data-quality checks move into Admin.

**MQ-3 · Know which CM is signed in** · S · P1 · Ready · *enabler*
- Add each staff member's sign-in email; CMs default to their own region(s) with a switch to see all; non-CM staff see all regions.

**MQ-22 · Hand Southeast to the new CM** · S · P1 · Ready (when they start)
- Add them in Admin → Staff, assign Southeast, and leave Sean on Global only. Update EventFlow's copy of the region model at the same time (Southeast's CM name and Slack mention in its needs-attention alerts).

### Dashboard and performance goals

**MQ-6 · CM Dashboard** · M · P1 · Decided
- For the signed-in CM's region. Every number shows a **trend line** (by week within the quarter, and by quarter), not just today's value:
  1. **Goals at a glance:** progress on each goal, this quarter and this year to date, side by side. No combined score.
  2. **Event attendance vs goal:** this quarter's events, each with actual attendance, its goal, and whether it was full. Plus **upcoming events with registrations vs goal**, so a CM can see which dinners need more people while there is still time (MQ-19).
  3. **New members in expansion cities:** count vs target, per city (MQ-18).
  4. **Member engagement:** the region's share of members actively participating (MQ-21). Becomes a goal in Q1 2027, so its trend is worth showing now.
  5. **New-member activation:** share of members joined in the last 90 days who have started participating (MQ-12).
  6. **Needs attention:** how many members are waiting in My Priorities, with a link.
- "All regions" view for non-CM staff.

**MQ-18 · Expansion cities per CM** · S · P1 · Needs decision
- Admin page to assign each CM's expansion cities and a target per city, for the quarter and for the year (default 5 from the plan). Counts new members by Closest Major City and the date they became Active (until "onboarded" is defined, MQ-12).
- Needs: expansion city lists for Brandy and Madi, and for the new Southeast CM once they start (Anjie's are in the plan). Global has none unless the team adds some.

**MQ-19 · Event attendance goals** · M · P1 · Decided
- For each Networking Dinner and Experience Event in a region: the goal from its city's member count (10, 15, 20 or 25), actual attendance by active practitioners, and capacity. Events that reached capacity (full or waitlisted) are marked **Full** and their goal is capped at capacity. Registrations vs goal for upcoming events.
- **Active practitioner:** practicing security leaders only. Determined from the attendee's contact record; sponsors, vendors, Confide staff and guests are excluded. During the build, confirm how EventFlow tags sponsors and vendors.
- The "members in city" count used for the goal comes from MEQ, the same number CMs see.
- Open: whether the v1 Anti-Summit targets carry over (see "Anti-Summits" above). Dinners can be built without it.

**MQ-20 · Goal scorecard, by quarter and year** · M · P1 · Ready (after MQ-18, MQ-19)
- Per CM, per goal: actual vs target for this quarter, this year to date, and past periods for comparison. Shown on the Dashboard and in an all-CM view for managers, which is what the year-end review uses.
- No bonus formula, weighting, combined score or dollars.

**MQ-21 · An engagement measure that can improve** · S · P1 · Needs decision
- Tiers are relative (finding 2), so the 2027 engagement goal needs an absolute measure. Proposed: **share of the region's members who participated in the last 90 days** (attended a live event, posted on Slack or Circle, or visited Circle). Easy to explain, can rise or fall, and comparable across regions.
- Needs: the team agrees the measure; targets set before Q1 2027.

### Members & engagement

**MQ-4 · Members page (replaces Engagement, Quality, Quadrant)** · L · P1 · Ready
- One table of every member, filterable by region, CM, engagement, quality, company, seniority, member since, and channel. Saved filters, CSV export. The quadrant chart is retired.

**MQ-5 · My Priorities with activity log (replaces Outreach)** · M · P1 · Decided
- The signed-in CM's region: new members not yet participating, declining members, dormant members, high-quality members with low engagement.
- CMs log activity on a member: **contacted, snoozed (until a date), note**, plus other actions such as *called*, *met at an event*, *introduced to someone*, *invited to an event*. Snoozed members leave the list until the date; the history shows on the member's profile so CMs see each other's follow-up.

**MQ-7 · Live events in the score; virtual counted separately** · S · P1 · Decided
- The engagement score's Events dimension counts **in-person events only**. Virtual attendance is measured and shown as its own count (profile, Members, regions), but adds nothing to the overall score. Bump the cache version; annotate trend charts.

**MQ-8 · Engagement by channel: Slack, Circle, virtual, in-person** · M · P2 · Ready
- Per-member activity by channel on the profile, as Members columns and filters, and by region. Circle gets richer once MQ-11 stores Circle's own activity.

**MQ-9 · Don't penalize members far from events** · M · P2 · Decided
- In-person events scored as attended out of invited. A member never invited to a dinner isn't marked down for missing one.

### New members

**MQ-10 · New Members page with a funnel** · L · P2 · Ready (one step depends on MQ-12)
- Funnel per member and per cohort, by region and CM, with conversion and time between steps:

| Step | Source | Status |
|---|---|---|
| Prospect | HubSpot membership status history | needs Prospect/Pending contacts in MEQ |
| Asked to join (Pending) | HubSpot status history; `application_date` | same |
| Active (completed onboarding form) | status history; `date_joined` | available |
| First Circle login | Circle `accepted_invitation` | after MQ-11 |
| Last Circle visit | Circle `last_seen_at` | after MQ-11 |
| First participation | MEQ activity | available |
| First live event | EventFlow attendance | available |
| Community manager | region → staff | available |

- Requires MEQ to also read Prospect and Pending contacts (today it reads Active members only).

**MQ-11 · Capture Circle logins** · M · P2 · Decided
- Recommended: CircleHub writes first login, last visit, and post/comment counts to new HubSpot properties daily, the way it already writes `circle_active`. MEQ and EventFlow pick them up. Start early so login history builds up.

**MQ-12 · Define "Onboarded" and "Activated"** · Needs decision (team)
- Lifecycle today: Prospect → Pending (asked to join) → Active (completed the onboarding form).
- **Onboarded:** left for the team to decide. It also decides when a new member counts toward the expansion-city goal (MQ-18).
- **Activated:** proposed as first real participation (a live event, a Slack/Circle post, or a Circle login) within 30 days of becoming Active. Used by My Priorities, the Dashboard and the funnel.

### Regions

**MQ-13 · Regions over time** · M · P2 · Ready
- Membership growth, engagement change, and new-member activation by region and CM, from weekly snapshots.

**MQ-14 · Map under Regions** · S · P2 · Ready
- Delivered with MQ-1.

**MQ-15 · Top Cities insights** · S · P2 · Ready
- Fastest growing, most engaged and least engaged cities, on Regions (and the Dashboard where room allows).

### Location

**MQ-16 · Members' real city** · Not planned
**MQ-17 · Home city on the onboarding form** · Not planned
- Location stays the Closest Major City from the onboarding form.

---

## Open questions

1. **Expansion cities** for Brandy and Madi, and for the new Southeast CM once they start. (MQ-18)
2. **Anti-Summits:** do the v1 targets (50 attendees, 12 qualified non-members, 6 new members per Anti-Summit) carry over? (MQ-19)
3. **Full events:** confirm that an event at capacity has its goal capped at capacity. (MQ-19)
4. **Engagement goal:** agree the proposed measure; set targets before Q1 2027. (MQ-21)
5. **Onboarded:** team to define. (MQ-12)
6. **Activated:** confirm the proposed definition. (MQ-12)

---

## Suggested order

1. **Foundation:** MQ-1, MQ-2, MQ-3, MQ-7. Start MQ-11 early so Circle login history builds up. MQ-22 when the new Southeast CM starts.
2. **Goals Dashboard:** MQ-18, MQ-19, MQ-21, MQ-20, then MQ-6. Ready well before Q1 2027.
3. **Daily CM workflow:** MQ-5 My Priorities, MQ-4 Members.
4. **Scoring:** MQ-8 channels, MQ-9 attended-out-of-invited.
5. **New members:** MQ-12 decisions, then MQ-10.
6. **Regions:** MQ-13, MQ-14, MQ-15.
