import postgres from "postgres";
const meq = postgres(process.env.MEQ_PG, { ssl: "require" });

const terr = await meq`
  SELECT territory, COUNT(*)::int n
  FROM member_engagement_snapshots
  WHERE week_start = (SELECT MAX(week_start) FROM member_engagement_snapshots)
  GROUP BY 1 ORDER BY n DESC`;
console.log("LATEST WEEK by territory:");
for (const r of terr) console.log(`  ${String(r.territory).padEnd(5)} ${r.n}`);

const trend = await meq`
  SELECT to_char(week_start,'MM-DD') wk,
         COUNT(*) FILTER (WHERE tier='Champion')::int champ,
         COUNT(*) FILTER (WHERE tier='Active')::int active,
         COUNT(*) FILTER (WHERE tier='Dormant')::int dormant,
         ROUND(AVG(total)::numeric,1) avg_total
  FROM member_engagement_snapshots
  GROUP BY week_start ORDER BY week_start`;
console.log("\nTIER TREND (all territories):");
console.log("  week   champ active dormant avgTotal");
for (const r of trend) console.log(`  ${r.wk}  ${String(r.champ).padStart(5)} ${String(r.active).padStart(6)} ${String(r.dormant).padStart(7)} ${String(r.avg_total).padStart(8)}`);

await meq.end();
