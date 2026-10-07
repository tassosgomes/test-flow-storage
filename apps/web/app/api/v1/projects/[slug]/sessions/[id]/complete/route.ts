import { handleCompleteSession } from "@/server/v1";

export const dynamic = "force-dynamic";

export function POST(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  return context.params.then(({ slug, id }) => handleCompleteSession(request, slug, id));
}
