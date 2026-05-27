const HS_BASE = "https://api.hubapi.com";

export type HsContact = { id: string; properties: Record<string, string | null> };

/**
 * Batch-read HubSpot contacts by record id (max 100 per call). Missing ids
 * are silently omitted from results. Read-only.
 */
export async function batchReadContacts(
  ids: string[],
  properties: string[]
): Promise<HsContact[]> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) throw new Error("HUBSPOT_PRIVATE_APP_TOKEN is not set");

  const out: HsContact[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/batch/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties,
        inputs: chunk.map((id) => ({ id })),
      }),
    });
    // 207 = partial success (some ids missing); still has results.
    if (!res.ok && res.status !== 207) {
      const body = await res.text();
      throw new Error(`HubSpot batch read failed ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { results?: HsContact[] };
    if (data.results) out.push(...data.results);
  }
  return out;
}
