"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { meqDb, schema } from "@/lib/db/meq";
import { normalizeName } from "@/lib/sync/referrals";
import { STAFF_TAG } from "@/lib/staff";
import { TERRITORIES } from "@/lib/territory";

function bust() {
  revalidateTag(STAFF_TAG);
  revalidatePath("/admin/staff");
}

export async function addStaff(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const aliasesRaw = String(formData.get("aliases") ?? "").trim();
  const region = String(formData.get("region") ?? "");
  const aliases = aliasesRaw
    ? aliasesRaw.split(",").map((a) => a.trim()).filter(Boolean)
    : [];

  await meqDb
    .insert(schema.staff)
    .values({
      name,
      normalizedName: normalizeName(name),
      aliases,
      region: (TERRITORIES as readonly string[]).includes(region) ? region : null,
    })
    .onConflictDoNothing();
  bust();
}

export async function updateStaffRegion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const region = String(formData.get("region") ?? "");
  if (!id) return;
  await meqDb
    .update(schema.staff)
    .set({ region: (TERRITORIES as readonly string[]).includes(region) ? region : null })
    .where(eq(schema.staff.id, id));
  bust();
}

export async function deleteStaff(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await meqDb.delete(schema.staff).where(eq(schema.staff.id, id));
  bust();
}
