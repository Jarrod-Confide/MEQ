import Link from "next/link";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** Every /admin page is admins-only. Others get a plain no-access message. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.isAdmin) return children;
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">MEQ · Admin</div>
      <h1 className="mt-2 text-xl font-semibold">Admin access needed</h1>
      <p className="mt-2 text-[13px] text-[#9bb0d4]">
        {viewer.email ? `${viewer.email} isn't on the admin list.` : "You're not signed in."} Ask an admin to add
        you in Admin → Admins.
      </p>
      <Link href="/" prefetch={false} className="mt-6 inline-block text-[13px] text-[#8ab4ff] hover:underline">
        ← Dashboard
      </Link>
    </div>
  );
}
