import { getAuth } from "@/lib/auth";
import { artifactForUser } from "@/server/portal";
import { getStore } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const file = await artifactForUser(session.user.id, id);
  if (!file) return Response.json({ error: "not_found" }, { status: 404 });
  const body = await getStore().get(file.r2Key);
  if (!body) return Response.json({ error: "not_found" }, { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": file.contentType,
      "cache-control": "private, max-age=60",
    },
  });
}
