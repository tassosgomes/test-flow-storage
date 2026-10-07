import { getStore, verifyStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  const contentType = url.searchParams.get("ct") || "";
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") || "";
  const sent = request.headers.get("content-type") || "";
  if (
    !verifyStorage("PUT", key, contentType, exp, sig) ||
    sent.split(";")[0] !== contentType.split(";")[0]
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = Buffer.from(await request.arrayBuffer());
  await getStore().put(key, body);
  return new Response(null, { status: 204 });
}
