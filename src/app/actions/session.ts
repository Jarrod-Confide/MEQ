"use server";

import { redirect } from "next/navigation";
import { MEMBERHUB_URL } from "@/lib/auth/memberhub";

/** Sign-out happens in MemberHub (one login for both). */
export async function signOutAction() {
  redirect(`${MEMBERHUB_URL}/sign-out`);
}
