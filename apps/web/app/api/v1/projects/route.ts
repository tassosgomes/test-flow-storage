import { handleCreateProject, handleListProjects } from "@/server/v1";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleListProjects(request);
}

export function POST(request: Request) {
  return handleCreateProject(request);
}
