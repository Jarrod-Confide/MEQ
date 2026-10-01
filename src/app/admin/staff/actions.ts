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

/** The region checkboxes submitted with the form, validated. */
function regionsFrom(formData: FormData): string[] {
  return formData
    .getAll("regions")
    .map(String)
    .filter((r) => (TERRITORIES as readonly string[]).includes(r));
}

export async function addStaff(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const aliasesRaw = String(formData.get("aliases") ?? "").trim();
  const aliases = aliasesRaw
    ? aliasesRaw.split(",").map((a) => a.trim()).filter(Boolean)
    : [];

  await meqDb
    .insert(schema.staff)
    .values({ name, normalizedName: normalizeName(name), aliases, regions: regionsFrom(formData) })
    .onConflictDoNothing();
  bust();
}

export async function updateStaffRegions(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await meqDb
    .update(schema.staff)
    .set({ regions: regionsFrom(formData) })
    .where(eq(schema.staff.id, id));
  bust();
}

export async function deleteStaff(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await meqDb.delete(schema.staff).where(eq(schema.staff.id, id));
  bust();
}
