# Switching MEQ to read members from MemberHub

**Status (2026-10-15):** code shipped with `MEMBER_SOURCE` unset (= EventFlow). Dry run: `GET /api/cron/memberhub-compare` (Bearer CRON_SECRET). Flip `MEMBER_SOURCE=memberhub` in Vercel Production, then push a fresh commit. Deferred: `m:<member_number>` keys (engagement still identifies people by their EventFlow contact, which every MemberHub member has); add them if the dry run shows members without one.

The hand-off from MemberHub follows.

---

# MEQ hand-off: read members from MemberHub (one way)

Prepared 2026-10-15 from MemberHub `main` and MEQ `main` (d89a10e). Supersedes `HANDOFF-meq-notes.md`.
Copy this into MEQ's `docs/` (for example `docs/MEMBERHUB-SWITCH.md`) and update `docs/HANDOFF.md` when done.

## Why, and the one rule

MemberHub (members.thecisosociety.com) is the member system of record. EventFlow switched to it on
2026-10-15 (2,277 of 2,277 matched, 0 errors), so EventFlow's `contacts` are now a copy of MemberHub.
MEQ should read the roster from MemberHub directly instead of a copy of a copy.

**One way only (Jarrod, 2026-10-15): "It should just be one way from MemberHub."** MEQ reads; it never
writes member data back. The key below has read scopes only. MEQ's own data (engagement, quality,
referrals, milestones, goals, snapshots) stays in MEQ.

## The API

Spec: `memberhub/docs/api/openapi.yaml`. Base `https://members.thecisosociety.com/api/v1`,
`Authorization: Bearer <key>`.

- **Key: set up 2026-10-16 (Jarrod approved).** MemberHub key `meq`, scopes
  `members:read`, `members:read_contact`, `members:lookup` (no write scopes). Stored in MEQ's Vercel
  **Production** env as `MEMBERHUB_API_KEY` (sensitive, can't be pulled) plus
  `MEMBERHUB_API_URL=https://members.thecisosociety.com/api/v1`. The next MEQ build (a fresh commit) picks them up. Never paste keys in chat; for local work
  ask Jarrod for a `meq-dev` key (Setup > API keys).
- **Roster:** `GET /members?limit=1000` (default `status=active`), follow `next_cursor` until null.
  A whole roster pages by member number (no cut-off), so nobody changed mid-read is skipped (D87).
- **Changes since:** `GET /members?updated_since=<as_of>&include_removed=true`; `removed[]` lists people
  who left Active (`status`) or were merged (`merged_into`).
- **By email:** `GET /members/lookup?email=` (any status, any of their addresses).
- **Webhooks (optional):** `status.changed`, `person.updated`, `person.merged`, signed `MemberHub-Signature`.
  The daily pull is enough for MEQ; add webhooks only if a page needs same-hour freshness.

## Field mapping (EventFlow `contacts` today -> MemberHub member)

| MEQ `members` | Today | MemberHub |
| --- | --- | --- |
| new `member_number` (int, unique) | none | `member_number` (the key from now on) |
| `eventflow_contact_id` | `contacts.id` | keep for now (see keys below); not needed for new rows |
| `hubspot_contact_id` | `contacts.hubspot_contact_id` | `accounts.hubspot_contact_id` |
| `slack_user_id`, `circle_member_id` | Slackle by email | `accounts.slack_user_id`, `accounts.circle_member_id` (drop the Slackle lookup) |
| `email`, `additional_emails` | contacts email columns | `email_for.login`, plus the other `emails[]` |
| `first_name`, `last_name`, `company`, `job_title` | contacts | same names (`job_title`); company is MemberHub's company record (D80) |
| `membership_type`, `is_member` | contacts | `status` (`active` = member); keep `membership_type` only if a page shows it |
| `closest_major_city` | contacts | `closest_major_city` |
| region (computed by closest city) | MEQ's own rule | `region` (state first, then city), so CM goals match EventFlow and MemberHub |
| `joined_at`, `joined_source` | HubSpot | `joined_at` (when they became Active); `joined_source = 'memberhub'` |
| `industry`, `company_size` | later enrichment | `industry`, `company_size`, `employees` |
| referred-by | HubSpot | `referred_by` (their own answer, free text) |

Keep HubSpot quality scores and email clicks as they are until HubSpot is retired (MemberHub B78 will
bring email engagement into MemberHub; MEQ can switch to it then).

## Work in MEQ

1. **Add `members.member_number`** (integer, unique, nullable). Fill it on the first MemberHub run by
   matching `hubspot_contact_id`, then any email. EventFlow's `contacts.member_number` is filled for all
   2,277 members and is a second check.
2. **Never delete and re-create `members` rows.** The purge cascades to `member_quality`,
   `member_referrals` and `member_milestones`. Update in place; a merged person (`removed[].merged_into`)
   moves to the winner's row by updating the loser's child rows, then retiring the loser.
3. **A source switch:** `MEMBER_SOURCE=eventflow|memberhub` (default `eventflow`) with a MemberHub reader
   beside `src/lib/sync/members.ts`. Upsert on `member_number` once filled. Leavers: people no longer
   Active keep their row with `is_member = false` (history and snapshots still point at them).
4. **Keys in URLs and snapshots:** `c:<eventflow uuid>` keys appear in about 14 files, stored engagement
   snapshots and `/engagement/[key]` URLs. Add `m:<member_number>` keys, keep resolving old `c:` keys
   (look up by `eventflow_contact_id`), and write new snapshots with `m:` keys. No history rewrite needed.
5. **Regions:** use MemberHub's `region` (codes NE, CENTRAL, WEST, SE, OTHER = Global). The CM owner
   per region stays MEQ's `staff.regions`.
6. **`/api/v1/member-stats`** (EventFlow reads it): add `member_number` to each row so EventFlow can join
   on it; keep the current key until EventFlow confirms it has moved.
7. **Compare before switching:** a dry run listing MEQ members with no MemberHub match, MemberHub Active
   members missing from MEQ, and region differences. Expect zero unmatched (EventFlow matched 2,277/2,277).
   Show Jarrod the counts, then flip `MEMBER_SOURCE` with a fresh commit (a plain redeploy reuses the old env).
8. Keep the pool rules: one paged read in the cron, never per request; pools max 5, batches of 4 or fewer.

## Afterwards

- Drop the EventFlow `contacts` and Slackle roster reads from the member sync (Slackle stays for messages).
- Report the numbers to MemberHub (session "MemberHub"): read, matched, updated, created, unmatched, errors.
