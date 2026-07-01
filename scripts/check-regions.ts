import { loadEnvLocal } from "./load-env";
loadEnvLocal();

import { meqSql } from "../src/lib/db/meq";
import { CITY_GEO } from "../src/lib/cities";
import { territoryFromCity, TERRITORY_ORDER, TERRITORY_LABEL } from "../src/lib/territory";

async function main() {
  const rows = await meqSql<{ city: string | null; n: number }[]>`
    SELECT closest_major_city city, COUNT(*)::int n
    FROM members
    WHERE eventflow_contact_id IS NOT NULL
    GROUP BY closest_major_city`;

  const byRegion = new Map<string, number>();
  const otherUsStates = new Map<string, number>(); // US cities landing in OTHER (unassigned states)
  const unmapped = new Map<string, number>(); // city not in CITY_GEO

  let total = 0;
  for (const r of rows) {
    total += r.n;
    const region = territoryFromCity(r.city);
    byRegion.set(region, (byRegion.get(region) ?? 0) + r.n);
    const geo = r.city ? CITY_GEO[r.city] : undefined;
    if (!geo && r.city) unmapped.set(r.city, (unmapped.get(r.city) ?? 0) + r.n);
    if (region === "OTHER" && geo?.country === "US") {
      const key = `${r.city} (${geo.state ?? "?"})`;
      otherUsStates.set(key, (otherUsStates.get(key) ?? 0) + r.n);
    }
  }

  console.log(`\nTotal matched members: ${total}\n`);
  console.log("By region:");
  for (const t of TERRITORY_ORDER) {
    const n = byRegion.get(t) ?? 0;
    console.log(`  ${TERRITORY_LABEL[t].padEnd(14)} ${String(n).padStart(5)}  (${((n / total) * 100).toFixed(1)}%)`);
  }

  if (otherUsStates.size) {
    console.log("\n⚠️  US members landing in OTHER (state not assigned to any region in the doc):");
    for (const [k, n] of [...otherUsStates.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(24)} ${n}`);
    }
  } else {
    console.log("\n✓ No US members fell into OTHER.");
  }

  if (unmapped.size) {
    const totUnmapped = [...unmapped.values()].reduce((s, n) => s + n, 0);
    console.log(`\nCities with no geo entry (→ OTHER), ${totUnmapped} members across ${unmapped.size} cities:`);
    for (const [k, n] of [...unmapped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${(k || "(blank)").padEnd(28)} ${n}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
