import { unstable_cache } from "next/cache";
import { meqDb, schema } from "./db/meq";
import { TERRITORIES, TERRITORY_CM, type Territory } from "./territory";

export const STAFF_TAG = "staff";

/** Staff names per region (for dashboard CM labels). Cached 5 min. */
export function getStaffByRegion(): Promise<Partial<Record<Territory, string[]>>> {
  return unstable_cache(
    async () => {
      const rows = await meqDb
        .select({ name: schema.staff.name, regions: schema.staff.regions })
        .from(schema.staff);
      const out: Partial<Record<Territory, string[]>> = {};
      for (const r of rows) {
        for (const region of r.regions ?? []) {
          if (!(TERRITORIES as readonly string[]).includes(region)) continue;
          (out[region as Territory] ??= []).push(r.name);
        }
      }
      for (const list of Object.values(out)) list.sort();
      return out;
    },
    ["staff-by-region-v2"],
    { revalidate: 300, tags: [STAFF_TAG] }
  )();
}

/** CM display name(s) per region: assigned staff, else the hardcoded fallback. */
export async function getCmByRegion(): Promise<Record<Territory, string | null>> {
  const byRegion = await getStaffByRegion();
  return Object.fromEntries(
    TERRITORIES.map((t) => [t, byRegion[t]?.join(", ") || TERRITORY_CM[t]])
  ) as Record<Territory, string | null>;
}
