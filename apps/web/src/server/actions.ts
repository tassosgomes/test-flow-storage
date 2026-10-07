"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "../lib/auth";
import { createApiKeyForUser, createProjectForUser, requireUser, revokeApiKeyForUser } from "./portal";

export async function logout() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}

export async function createProjectAction(formData: FormData): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const name = String(formData.get("name") || "");
  const slug = String(formData.get("slug") || "");
  const result = await createProjectForUser(user.id, name, slug);
  if (result.error) return { error: result.error };
  redirect(`/projects/${result.slug}`);
}

export async function createApiKeyAction(
  formData: FormData,
): Promise<{ error: string } | { secret: string }> {
  const user = await requireUser();
  return createApiKeyForUser(user.id, String(formData.get("name") || ""));
}

export async function revokeApiKeyAction(formData: FormData) {
  const user = await requireUser();
  await revokeApiKeyForUser(user.id, String(formData.get("id") || ""));
  revalidatePath("/settings/api-keys");
}
