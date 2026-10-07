import { handlePushSession } from "@/server/v1";

export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return context.params.then(({ slug }) =>
    handlePushSession(request, slug, new URL(request.url).origin),
  );
}
