import postgres from "postgres";

const meq = postgres(process.env.MEQ_PG, { ssl: "require" });
const sl = postgres(process.env.SLACKLE_PG, { ssl: "require" });

const tot = await meq`
  SELECT COUNT(*)::int n,
         ROUND(AVG(content_weight)::numeric,2) aw,
         SUM(CASE WHEN is_connector THEN 1 ELSE 0 END)::int conn
  FROM message_scores`;
console.log(`TOTAL scored: ${tot[0].n} | avg weight ${tot[0].aw} | connector msgs ${tot[0].conn}`);

const byType = await meq`
  SELECT type, COUNT(*)::int c, ROUND(AVG(content_weight)::numeric,1) aw
  FROM message_scores GROUP BY 1 ORDER BY c DESC`;
console.log("\nBY TYPE:");
for (const r of byType) console.log(`  ${String(r.type).padEnd(17)} ${String(r.c).padStart(5)}  avg wt ${r.aw}`);

const bands = await meq`
  SELECT CASE
    WHEN content_weight = 0 THEN '0 noise/social'
    WHEN content_weight < 3 THEN '1-2 low'
    WHEN content_weight < 7 THEN '3-6 mid'
    ELSE '7-10 high' END AS band,
    COUNT(*)::int c
  FROM message_scores GROUP BY 1 ORDER BY 1`;
console.log("\nWEIGHT BANDS:");
for (const r of bands) console.log(`  ${r.band.padEnd(16)} ${r.c}`);

// ── Before/after: rank authors by VOLUME (msg count) vs CONTENT (sum weight) ──
const agg = await meq`
  SELECT author_email,
         COUNT(*)::int msgs,
         ROUND(SUM(content_weight)::numeric,1) sw,
         ROUND(AVG(substance)::numeric,2) asub
  FROM message_scores
  WHERE author_email IS NOT NULL AND type <> 'noise'
  GROUP BY 1`;
const names = await sl`
  SELECT lower(author_email) email, max(author_display_name) name
  FROM messages WHERE author_email IS NOT NULL GROUP BY 1`;
const nameByEmail = new Map(names.map((r) => [r.email, r.name]));

const byVolume = [...agg].sort((a, b) => b.msgs - a.msgs);
const byContent = [...agg].sort((a, b) => Number(b.sw) - Number(a.sw));
const volRank = new Map(byVolume.map((r, i) => [r.author_email, i + 1]));
const conRank = new Map(byContent.map((r, i) => [r.author_email, i + 1]));

const nm = (e) => (nameByEmail.get(e) || e || "?").slice(0, 22);
console.log("\nTOP 12 BY CONTENT (sum weight) — with their VOLUME rank:");
console.log("  content# (vol#)  name                    msgs  sumWt  avgSub");
for (const r of byContent.slice(0, 12)) {
  const cr = conRank.get(r.author_email), vr = volRank.get(r.author_email);
  const move = vr - cr;
  const tag = move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : "=";
  console.log(`  #${String(cr).padStart(2)} (vol#${String(vr).padStart(2)}) ${tag.padEnd(5)} ${nm(r.author_email).padEnd(22)} ${String(r.msgs).padStart(4)}  ${String(r.sw).padStart(5)}  ${r.asub}`);
}

console.log("\nTOP 8 BY VOLUME (msg count) — where they land on CONTENT:");
console.log("  vol# (content#)  name                    msgs  sumWt  avgSub");
for (const r of byVolume.slice(0, 8)) {
  const cr = conRank.get(r.author_email), vr = volRank.get(r.author_email);
  const move = vr - cr;
  const tag = move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : "=";
  console.log(`  #${String(vr).padStart(2)} (con#${String(cr).padStart(2)}) ${tag.padEnd(5)} ${nm(r.author_email).padEnd(22)} ${String(r.msgs).padStart(4)}  ${String(r.sw).padStart(5)}  ${r.asub}`);
}

await meq.end();
await sl.end();
