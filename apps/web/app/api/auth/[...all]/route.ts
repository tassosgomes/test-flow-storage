import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const handlers = toNextJsHandler(getAuth());
  if (request.method === "POST") return handlers.POST(request);
  return handlers.GET(request);
}

export { handle as GET, handle as POST };
