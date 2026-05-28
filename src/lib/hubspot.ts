const HS_BASE = "https://api.hubapi.com";

export type HsObject = { id: string; properties: Record<string, string | null> };
export type HsContact = HsObject;

function token(): string {
  const t = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!t) throw new Error("HUBSPOT_PRIVATE_APP_TOKEN is not set");
  return t;
}

/**
 * Batch-read any HubSpot object by record id (max 100 per call). Missing ids
 * are silently omitted. Read-only.
 */
export async function batchRead(
  objectType: string,
  ids: string[],
  properties: string[]
): Promise<HsObject[]> {
  const out: HsObject[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await fetch(`${HS_BASE}/crm/v3/objects/${objectType}/batch/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties, inputs: chunk.map((id) => ({ id })) }),
    });
    if (!res.ok && res.status !== 207) {
      const body = await res.text();
      throw new Error(`HubSpot ${objectType} read failed ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { results?: HsObject[] };
    if (data.results) out.push(...data.results);
  }
  return out;
}

export function batchReadContacts(ids: string[], properties: string[]) {
  return batchRead("contacts", ids, properties);
}

/**
 * Batch-read associations (max 100 per call). Returns a map of fromId →
 * associated toIds, with any "primary"-labeled association first.
 */
export async function batchReadAssociations(
  fromType: string,
  toType: string,
  ids: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await fetch(
      `${HS_BASE}/crm/v4/associations/${fromType}/${toType}/batch/read`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
      }
    );
    if (!res.ok && res.status !== 207) {
      const body = await res.text();
      throw new Error(`HubSpot assoc read failed ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      results?: {
        from: { id: string };
        to: { toObjectId: number; associationTypes?: { label?: string | null }[] }[];
      }[];
    };
    for (const r of data.results ?? []) {
      const sorted = [...r.to].sort((a, b) => {
        const ap = a.associationTypes?.some((t) => /primary/i.test(t.label ?? "")) ? 0 : 1;
        const bp = b.associationTypes?.some((t) => /primary/i.test(t.label ?? "")) ? 0 : 1;
        return ap - bp;
      });
      map.set(
        r.from.id,
        sorted.map((t) => String(t.toObjectId))
      );
    }
  }
  return map;
}
