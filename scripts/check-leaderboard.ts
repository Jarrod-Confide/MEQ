import { computeEngagement, DIMENSION_WEIGHTS } from "../src/lib/engagement";

async function main() {
  const r = await computeEngagement({ sinceDays: 90 });
  console.log(`scored: ${r.scoredCount} | tiers:`, r.tierCounts);
  const dims = Object.keys(DIMENSION_WEIGHTS);
  console.log("\ntier total  " + dims.map((d) => d.slice(0, 5).padStart(6)).join("") + "  name");
  for (const m of r.members.slice(0, 15)) {
    const row = dims.map((d) => String(Math.round((m.dimensions as any)[d])).padStart(6)).join("");
    console.log(
      `${String(m.tier[0])}  ${String(m.total).padStart(5)} ${row}  ${m.name} ` +
        `(ev${m.signals.eventsAttended} p${m.signals.posts} r${m.signals.replies} sub${m.signals.avgSubstance})`
    );
  }
}
main().then(() => process.exit(0));
