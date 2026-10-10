import { redirect } from "next/navigation";
import { memberHubSignIn } from "@/lib/auth/memberhub";

// MEQ uses MemberHub's sign-in now.
export default function SignInPage() {
  redirect(memberHubSignIn("/"));
}
