import type { ChecklistItemDto, Note, Paginated } from "@taskmaster/contracts";
import { http } from "@/services/http";
import {
  addLocalChecklistItem,
  createLocalNote,
  getLocalNote,
  isLocalNotesWorkspace,
  listLocalNotes,
  removeLocalChecklistItem,
  removeLocalNote,
  toggleLocalChecklistItem,
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

  // Pin y checklist tienen endpoints propios en la API: evitan reenviar el
  // formulario completo (y pisar ediciones concurrentes) para un cambio de un
  // solo campo. En el modo local se resuelven sobre el mismo store.
  pin: (workspaceId: string, id: string) =>
    isLocalNotesWorkspace(workspaceId)
      ? Promise.resolve(updateLocalNote(workspaceId, id, { pinned: true }))
      : http.post<Note>(`/workspaces/${workspaceId}/notes/${id}/pin`, {}),

  unpin: (workspaceId: string, id: string) =>
    isLocalNotesWorkspace(workspaceId)
      ? Promise.resolve(updateLocalNote(workspaceId, id, { pinned: false }))
      : http.post<Note>(`/workspaces/${workspaceId}/notes/${id}/unpin`, {}),

  addChecklistItem: (workspaceId: string, id: string, text: string) =>
    isLocalNotesWorkspace(workspaceId)
      ? Promise.resolve(addLocalChecklistItem(workspaceId, id, text))
      : http.post<ChecklistItemDto>(
          `/workspaces/${workspaceId}/notes/${id}/checklist`,
          { text },
        ),

  toggleChecklistItem: (
    workspaceId: string,
    id: string,
    itemId: string,
    done: boolean,
  ) =>
    isLocalNotesWorkspace(workspaceId)
      ? Promise.resolve(toggleLocalChecklistItem(workspaceId, id, itemId, done))
      : http.patch<ChecklistItemDto>(
          `/workspaces/${workspaceId}/notes/${id}/checklist/${itemId}`,
          { done },
        ),

  removeChecklistItem: (workspaceId: string, id: string, itemId: string) =>
    isLocalNotesWorkspace(workspaceId)
      ? Promise.resolve(removeLocalChecklistItem(workspaceId, id, itemId))
      : http.delete<{ id: string }>(
          `/workspaces/${workspaceId}/notes/${id}/checklist/${itemId}`,
        ),
};
