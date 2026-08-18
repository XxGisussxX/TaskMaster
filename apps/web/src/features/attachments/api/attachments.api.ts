import type { Attachment } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const attachmentsApi = {
  list: (workspaceId: string, context: { taskId?: string; noteId?: string }) =>
    http.get<Attachment[]>(
      `/workspaces/${workspaceId}/uploads${toQuery(context)}`,
    ),

  upload: (
    workspaceId: string,
    file: File,
    context: { taskId?: string; noteId?: string },
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    if (context.taskId) fd.append("taskId", context.taskId);
    if (context.noteId) fd.append("noteId", context.noteId);
    return http.upload<Attachment>(
      `/workspaces/${workspaceId}/uploads${toQuery(context)}`,
      fd,
    );
  },

  remove: (workspaceId: string, attachmentId: string) =>
    http.delete<{ id: string }>(
      `/workspaces/${workspaceId}/uploads/${attachmentId}`,
    ),
};

function toQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
