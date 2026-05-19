import { signIn } from "@/lib/auth/config";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f17]">
      <div className="w-full max-w-sm rounded-lg border border-[#1f2a3d] bg-[#111726] p-8">
        <div className="mb-8 text-center">
          <div className="text-5xl font-bold tracking-wider text-white">
            CONFIDE.
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#9bb0d4]">
            MEQ — Member Engagement and Quality
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-[#8ab4ff] px-4 py-2.5 text-sm font-medium text-[#0b0f17] transition hover:bg-[#a5c5ff]"
          >
            Sign in with Google
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-[#6a7da0]">
          @confide.group accounts only
        </p>
      </div>
    </div>
  );
}
