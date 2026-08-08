import type { Workspace } from "@taskmaster/contracts";
import { getLocalWorkspaceId } from "@/features/tasks/lib/localTasks";

export function getLocalWorkspace(): Workspace {
  const now = new Date().toISOString();

  return {
    id: getLocalWorkspaceId(),
    name: "Workspace demo",
    slug: "workspace-demo",
    icon: null,
    ownerId: "local-demo-user",
    members: [],
    createdAt: now,
  };
}
