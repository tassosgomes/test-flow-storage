import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/server/portal";

export default async function LoginPage() {
  if (await currentUser()) redirect("/projects");
  return <AuthForm mode="login" />;
}
