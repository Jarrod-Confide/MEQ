# MEQ — Member Engagement and Quality

Confide's cross-app member engagement + quality dashboard. Phase 1 ships a global member bubble map sourced from EventFlow's `contacts.closest_major_city`.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript + Tailwind 3
- Postgres (`postgres` lib) — reads EventFlow's Supabase
- NextAuth 5 + Google OAuth, `@confide.group`-only
- Leaflet (dynamically imported client-side) for the map

## Local dev

```bash
cp .env.local.example .env.local
# Fill in DATABASE_URL (EventFlow's), AUTH_SECRET (openssl rand -base64 32),
# GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm install
npm run dev
```

## Routes

- `/` — global member bubble map
- `/admin/unmatched` — cities present in DB but missing from `src/lib/cities.ts`
- `/sign-in` — Google OAuth gate

## Roadmap

- **Phase 1 (now)**: city heat map from EventFlow contacts.
- **Phase 2**: stand up MEQ's own Supabase, identity-resolution table linking Slack/Circle/HubSpot/EventFlow IDs, Slackle message volume → bubble color = engagement score.
- **Phase 3**: EventFlow attendance signals, composite scoring with recency decay, historical snapshots.
