import { unstable_cache } from "next/cache";
import { meqDb, schema } from "./db/meq";
import { resolveSettings, type PerformanceSettings, type SettingsKey } from "./performance";

export const SETTINGS_TAG = "settings";

/** Setup variables (app_settings over the defaults), cached 5 min. */
export const getSettings = unstable_cache(
  async (): Promise<PerformanceSettings> => {
    const rows = await meqDb.select().from(schema.appSettings);
    return resolveSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  },
  ["performance-settings-v1"],
  { revalidate: 300, tags: [SETTINGS_TAG] }
);

export async function saveSetting(key: SettingsKey, value: unknown, by: string | null): Promise<void> {
  await meqDb
    .insert(schema.appSettings)
    .values({ key, value, updatedBy: by, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value, updatedBy: by, updatedAt: new Date() },
    });
}
