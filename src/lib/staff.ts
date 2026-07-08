import { unstable_cache } from "next/cache";
import { meqDb, schema } from "./db/meq";
import type { Territory } from "./territory";

export const STAFF_TAG = "staff";

/** Staff names per region (for dashboard CM labels). Cached 5 min. */
export function getStaffByRegion(): Promise<Partial<Record<Territory, string[]>>> {
  return unstable_cache(
    async () => {
      const rows = await meqDb
        .select({ name: schema.staff.name, region: schema.staff.region })
        .from(schema.staff);
      const out: Partial<Record<Territory, string[]>> = {};
      for (const r of rows) {
        if (!r.region) continue;
        const t = r.region as Territory;
        (out[t] ??= []).push(r.name);
      }
      for (const list of Object.values(out)) list.sort();
      return out;
    },
    ["staff-by-region"],
    { revalidate: 300, tags: [STAFF_TAG] }
  )();
}
