/**
 * MemberHub (members.thecisosociety.com) is the member system of record.
 * MEQ READS it, one way only (Jarrod, 2026-10-15): the key has read scopes
 * only and nothing here writes member data back. Called from the member-sync
 * cron, never from a page render.
 */

export type HubMember = {
  member_number: number;
  aliases?: number[];
  status: string;
  joined_at: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  closest_major_city: string | null;
  region: "NE" | "CENTRAL" | "WEST" | "SE" | "OTHER";
  industry: string | null;
  company_size: string | null;
  accounts?: { hubspot_contact_id: string | null; circle_member_id: string | null; slack_user_id: string | null };
  emails?: { address: string; kind: string; status: string; purposes: string[] }[];
  email_for?: { login: string | null };
  is_test: boolean;
  updated_at: string;
};

export function memberHubConfigured(): boolean {
  return !!process.env.MEMBERHUB_API_KEY && !!process.env.MEMBERHUB_API_URL;
}

/** Every Active member, following next_cursor until it's null (1,000 a page). */
export async function fetchMemberHubRoster(): Promise<{ members: HubMember[]; asOf: string | null }> {
  const base = process.env.MEMBERHUB_API_URL;
  const key = process.env.MEMBERHUB_API_KEY;
  if (!base || !key) throw new Error("MEMBERHUB_API_URL / MEMBERHUB_API_KEY not set");
  const members: HubMember[] = [];
  let cursor: string | null = null;
  let asOf: string | null = null;
  for (let page = 0; page < 50; page++) {
    const url = new URL(`${base.replace(/\/$/, "")}/members`);
    url.searchParams.set("limit", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`MemberHub GET /members ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { members: HubMember[]; next_cursor: string | null; as_of: string };
    members.push(...body.members);
    asOf = body.as_of;
    cursor = body.next_cursor;
    if (!cursor) return { members, asOf };
  }
  throw new Error("MemberHub roster: more than 50 pages, stopping");
}
