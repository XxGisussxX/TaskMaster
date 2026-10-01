import type { Note, Paginated } from "@taskmaster/contracts";
import { http } from "@/services/http";
import {
  createLocalNote,
  getLocalNote,
  isLocalNotesWorkspace,
  listLocalNotes,
  removeLocalNote,
  updateLocalNote,
} from "../lib/localNotes";

export const notesApi = {
  list: (
    workspaceId: string,
    query: Record<string, string | boolean | number | undefined> = {},
  ) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "" && v !== "ALL") sp.set(k, String(v));
    }
    const qs = sp.toString();
    return isLocalNotesWorkspace(workspaceId)
      ? Promise.resolve(listLocalNotes(workspaceId, query))
      : http.get<Paginated<Note>>(
          `/workspaces/${workspaceId}/notes${qs ? `?${qs}` : ""}`,
        );
  },

  get: (workspaceId: string, id: string) =>
    isLocalNotesWorkspace(workspaceId)
      ? Promise.resolve(getLocalNote(workspaceId, id))
      : http.get<Note>(`/workspaces/${workspaceId}/notes/${id}`),

  create: (workspaceId: string, input: Record<string, unknown>) =>
    isLocalNotesWorkspace(workspaceId)
      ? Promise.resolve(createLocalNote(workspaceId, input))
      : http.post<Note>(`/workspaces/${workspaceId}/notes`, input),

  update: (workspaceId: string, id: string, input: Record<string, unknown>) =>
    isLocalNotesWorkspace(workspaceId)
      ? Promise.resolve(updateLocalNote(workspaceId, id, input))
      : http.patch<Note>(`/workspaces/${workspaceId}/notes/${id}`, input),

  remove: (workspaceId: string, id: string) =>
    isLocalNotesWorkspace(workspaceId)
      ? (removeLocalNote(workspaceId, id), Promise.resolve())
      : http.delete<void>(`/workspaces/${workspaceId}/notes/${id}`),
};
