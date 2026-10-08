import { unstable_cache } from "next/cache";
import { auth } from "./auth/config";
import { meqDb, schema } from "./db/meq";
import { TERRITORIES, type Territory } from "./territory";
import { STAFF_TAG } from "./staff";

export const ADMINS_TAG = "admins";

/**
 * Permanent admins, on top of the admins table, so a bad edit at
 * /admin/admins can never lock everyone out. MEQ_ADMIN_EMAILS (comma
 * separated) adds more without a deploy of code.
 */
export const BOOTSTRAP_ADMINS = ["jarrod@confide.group"];

function bootstrapAdmins(): string[] {
  const extra = (process.env.MEQ_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...BOOTSTRAP_ADMINS, ...extra];
}

/** Admin emails from the table, cached 5 min (busted on edit). */
const getAdminEmails = unstable_cache(
  async () => (await meqDb.select({ email: schema.admins.email }).from(schema.admins)).map((r) => r.email),
  ["admin-emails-v1"],
  { revalidate: 300, tags: [ADMINS_TAG] }
);

export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  const e = email?.toLowerCase();
  if (!e) return false;
  if (bootstrapAdmins().includes(e)) return true;
  try {
    return (await getAdminEmails()).includes(e);
  } catch {
    return false; // table unreachable: only bootstrap admins get in
  }
}

export function isBootstrapAdmin(email: string): boolean {
  return bootstrapAdmins().includes(email.toLowerCase());
}

export type Viewer = {
  email: string | null;
  name: string | null;
  isAdmin: boolean;
  /** The signed-in person's staff record, matched by sign-in email. */
  staff: { id: string; name: string; regions: Territory[] } | null;
};

const getStaffByEmail = unstable_cache(
  async () =>
    (
      await meqDb
        .select({ id: schema.staff.id, name: schema.staff.name, email: schema.staff.email, regions: schema.staff.regions })
        .from(schema.staff)
    ).filter((s) => s.email),
  ["staff-by-email-v1"],
  { revalidate: 300, tags: [STAFF_TAG] }
);

/** Who is signed in, whether they're an admin, and which regions are theirs. */
export async function getViewer(): Promise<Viewer> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;
  const name = session?.user?.name ?? null;
  if (!email) return { email: null, name, isAdmin: false, staff: null };
  const [isAdmin, staffRows] = await Promise.all([isAdminEmail(email), getStaffByEmail().catch(() => [])]);
  const s = staffRows.find((r) => r.email?.toLowerCase() === email);
  return {
    email,
    name,
    isAdmin,
    staff: s
      ? {
          id: s.id,
          name: s.name,
          regions: (s.regions ?? []).filter((r): r is Territory => (TERRITORIES as readonly string[]).includes(r)),
        }
      : null,
  };
}

/**
 * Guard for admin server actions. (Admin pages are guarded by
 * app/admin/layout.tsx, which shows a no-access message instead.)
 */
export async function requireAdmin(): Promise<Viewer> {
  const v = await getViewer();
  if (!v.isAdmin) throw new Error("Admin access required");
  return v;
}
