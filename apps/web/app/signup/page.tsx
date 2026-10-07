import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/server/portal";

export default async function SignupPage() {
  if (await currentUser()) redirect("/projects");
  return <AuthForm mode="signup" />;
}
