"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { meqDb, schema } from "@/lib/db/meq";
import { requireAdmin, ADMINS_TAG, isBootstrapAdmin } from "@/lib/viewer";
import { saveSetting, SETTINGS_TAG } from "@/lib/settings";
import { GOALS_TAG } from "@/lib/goals-data";
import type { EngagementMeasure, EventTier, EventTypeGoal } from "@/lib/performance";
import { TERRITORIES } from "@/lib/territory";

const int = (v: FormDataEntryValue | null): number | null => {
  const n = Number(String(v ?? "").trim());
  return String(v ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const num = (v: FormDataEntryValue | null): number | null => {
  const n = Number(String(v ?? "").trim());
  return String(v ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};
/** A stretch goal below its goal is a typo; lift it to the goal. */
const stretchOf = (goal: number, stretch: number | null) => Math.max(goal, stretch ?? goal);

function bustGoals() {
  revalidateTag(SETTINGS_TAG);
  revalidateTag(GOALS_TAG);
  revalidatePath("/", "layout");
}

// ─── Setup ─────────────────────────────────────────────────────────────────

export async function saveEventTiers(formData: FormData) {
  const v = await requireAdmin();
  const tiers: EventTier[] = [];
  for (let i = 0; i < 8; i++) {
    const minMembers = int(formData.get(`min_${i}`));
    const goal = int(formData.get(`goal_${i}`));
    if (minMembers === null || goal === null) continue;
    tiers.push({ minMembers, goal, stretch: stretchOf(goal, int(formData.get(`stretch_${i}`))) });
  }
  if (!tiers.length) return;
  tiers.sort((a, b) => a.minMembers - b.minMembers);
  tiers[0].minMembers = 0; // the smallest tier always starts at zero members
  await saveSetting("eventTiers", tiers, v.email);
  bustGoals();
}

export async function saveEventTypeGoals(formData: FormData) {
  const v = await requireAdmin();
  const out: Record<string, EventTypeGoal> = {};
  for (const slug of formData.getAll("slug").map(String)) {
    const mode = String(formData.get(`mode_${slug}`) ?? "none");
    if (mode === "city") out[slug] = { mode: "city" };
    else if (mode === "fixed") {
      const goal = int(formData.get(`goal_${slug}`));
      if (goal !== null) out[slug] = { mode: "fixed", goal, stretch: stretchOf(goal, int(formData.get(`stretch_${slug}`))) };
      else out[slug] = { mode: "none" };
    } else out[slug] = { mode: "none" };
  }
  await saveSetting("eventTypeGoals", out, v.email);
  bustGoals();
}

export async function saveEngagementMeasure(formData: FormData) {
  const v = await requireAdmin();
  const w = Number(formData.get("windowDays"));
  const goalPct = num(formData.get("goalPct"));
  const stretchPct = num(formData.get("stretchPct"));
  const measure: EngagementMeasure = {
    windowDays: w === 30 || w === 180 ? w : 90,
    countReactions: formData.get("countReactions") === "on",
    goalPct: goalPct === null ? null : Math.min(100, goalPct),
    stretchPct: goalPct === null ? null : Math.min(100, Math.max(goalPct, stretchPct ?? goalPct)),
  };
  await saveSetting("engagement", measure, v.email);
  bustGoals();
}

// ─── Expansion cities ──────────────────────────────────────────────────────

function cityFields(formData: FormData) {
  const region = String(formData.get("region") ?? "");
  const quarterGoal = int(formData.get("quarterGoal")) ?? 5;
  const yearGoal = int(formData.get("yearGoal")) ?? quarterGoal * 4;
  return {
    region: (TERRITORIES as readonly string[]).includes(region) ? region : "OTHER",
    quarterGoal,
    quarterStretch: stretchOf(quarterGoal, int(formData.get("quarterStretch"))),
    yearGoal,
    yearStretch: stretchOf(yearGoal, int(formData.get("yearStretch"))),
  };
}

export async function addExpansionCity(formData: FormData) {
  await requireAdmin();
  const city = String(formData.get("city") ?? "").trim();
  if (!city) return;
  await meqDb.insert(schema.expansionCities).values({ city, ...cityFields(formData) }).onConflictDoNothing();
  bustGoals();
}

export async function updateExpansionCity(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await meqDb
    .update(schema.expansionCities)
    .set({ ...cityFields(formData), active: formData.get("active") === "on" })
    .where(eq(schema.expansionCities.id, id));
  bustGoals();
}

export async function deleteExpansionCity(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await meqDb.delete(schema.expansionCities).where(eq(schema.expansionCities.id, id));
  bustGoals();
}

// ─── Admins ────────────────────────────────────────────────────────────────

export async function addAdmin(formData: FormData) {
  const v = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@confide\.group$/.test(email)) return; // sign-in is @confide.group only
  await meqDb.insert(schema.admins).values({ email, addedBy: v.email }).onConflictDoNothing();
  revalidateTag(ADMINS_TAG);
  revalidatePath("/admin/admins");
}

export async function removeAdmin(formData: FormData) {
  const v = await requireAdmin();
  const email = String(formData.get("email") ?? "").toLowerCase();
  // You can't remove yourself (no accidental lock-out); bootstrap admins are permanent anyway.
  if (!email || email === v.email || isBootstrapAdmin(email)) return;
  await meqDb.delete(schema.admins).where(eq(schema.admins.email, email));
  revalidateTag(ADMINS_TAG);
  revalidatePath("/admin/admins");
}
