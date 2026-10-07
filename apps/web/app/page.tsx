import { redirect } from "next/navigation";
import { currentUser } from "@/server/portal";

export default async function Home() {
  const user = await currentUser();
  redirect(user ? "/projects" : "/login");
}
