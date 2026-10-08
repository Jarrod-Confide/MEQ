import { unstable_cache } from "next/cache";
import { meqSql } from "./db/meq";
import { safeIso } from "./safe-date";
import { territoryFromCity, type Territory } from "./territory";

export const NEW_MEMBERS_TAG = "new-members";

export type JoinedMember = {
  name: string;
  city: string | null;
  region: Territory;
  efId: string | null;
  joinedAt: string;
  firstEventAt: string | null;
  firstVirtualAt: string | null;
  firstPostAt: string | null;
  firstReactionAt: string | null;
};

/**
 * Every Active member with a join date, plus their stored first-engagement
 * milestones (member_milestones, refreshed hourly). MEQ's own database only;
 * cached 10 minutes and busted by the milestones cron.
 */
export const getJoinedMembers = unstable_cache(
  async (): Promise<JoinedMember[]> => {
    const rows = await meqSql<
      {
        first_name: string | null;
        last_name: string | null;
        display_name: string | null;
        city: string | null;
        ef: string | null;
        joined_at: Date;
        first_event_at: Date | null;
        first_virtual_at: Date | null;
        first_post_at: Date | null;
        first_reaction_at: Date | null;
      }[]
    >`SELECT m.first_name, m.last_name, m.display_name, m.closest_major_city AS city,
             m.eventflow_contact_id AS ef, m.joined_at,
             mm.first_event_at, mm.first_virtual_at, mm.first_post_at, mm.first_reaction_at
      FROM members m LEFT JOIN member_milestones mm ON mm.member_id = m.id
      WHERE m.is_member AND m.joined_at IS NOT NULL`;
    return rows.flatMap((r) => {
      const joinedAt = safeIso(r.joined_at);
      if (!joinedAt) return [];
      return [
        {
          name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.display_name || "(no name)",
          city: r.city,
          region: territoryFromCity(r.city),
          efId: r.ef,
          joinedAt,
          firstEventAt: safeIso(r.first_event_at),
          firstVirtualAt: safeIso(r.first_virtual_at),
          firstPostAt: safeIso(r.first_post_at),
          firstReactionAt: safeIso(r.first_reaction_at),
        },
      ];
    });
  },
  ["new-members-v1"],
  { revalidate: 600, tags: [NEW_MEMBERS_TAG] }
);

/** When the milestones were last computed (null before the first run). */
export const getMilestonesComputedAt = unstable_cache(
  async (): Promise<string | null> => {
    const [r] = await meqSql<{ at: Date | null }[]>`SELECT MAX(computed_at) AS at FROM member_milestones`;
    return safeIso(r?.at ?? null);
  },
  ["milestones-computed-at-v1"],
  { revalidate: 600, tags: [NEW_MEMBERS_TAG] }
);
