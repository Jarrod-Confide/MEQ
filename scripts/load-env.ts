import { readFileSync } from "fs";
import { join } from "path";

/**
 * Loads .env.local into process.env for CLI tooling (drizzle-kit, scripts)
 * WITHOUT shell sourcing — values containing `&` (our pooler URLs) break
 * `set -a; . .env.local`, but reading the file directly is safe. Existing
 * env vars win (so CI/Vercel-provided values aren't overwritten).
 */
export function loadEnvLocal(file = ".env.local"): void {
  let txt: string;
  try {
    txt = readFileSync(join(process.cwd(), file), "utf8");
  } catch {
    return; // no .env.local (e.g. CI) — rely on real env
  }
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
