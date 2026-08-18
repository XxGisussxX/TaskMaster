import type { Comment } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const commentsApi = {
  list: (workspaceId: string, taskId: string) =>
    http.get<Comment[]>(`/workspaces/${workspaceId}/tasks/${taskId}/comments`),

  create: (workspaceId: string, taskId: string, input: { body: string }) =>
    http.post<Comment>(
      `/workspaces/${workspaceId}/tasks/${taskId}/comments`,
      input,
    ),

  update: (
    workspaceId: string,
    taskId: string,
    commentId: string,
    input: { body: string },
  ) =>
    http.patch<Comment>(
      `/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`,
      input,
    ),

  remove: (workspaceId: string, taskId: string, commentId: string) =>
    http.delete<void>(
      `/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`,
    ),
};
