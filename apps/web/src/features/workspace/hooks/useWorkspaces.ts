import { useQuery } from "@tanstack/react-query";
import { workspacesApi } from "../api/workspace.api";
import { getLocalWorkspace } from "../lib/localWorkspace";
import { ApiError } from "@/services/http";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      try {
        return await workspacesApi.list();
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.status === 403)
        ) {
          throw err;
        }
        console.warn("Workspaces API unavailable, using local fallback", err);
        return [getLocalWorkspace()];
      }
    },
  });
}
