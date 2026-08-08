import { useQuery } from "@tanstack/react-query";
import { workspacesApi } from "../api/workspace.api";
import { getLocalWorkspace } from "../lib/localWorkspace";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      try {
        return await workspacesApi.list();
      } catch {
        return [getLocalWorkspace()];
      }
    },
  });
}
