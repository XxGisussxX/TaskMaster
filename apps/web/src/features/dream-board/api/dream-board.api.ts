import type { DreamBoardDto } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const dreamBoardApi = {
  get: (workspaceId: string) =>
    http.get<DreamBoardDto>(`/workspaces/${workspaceId}/dream-board`),

  updateBoard: (workspaceId: string, title: string) =>
    http.patch<DreamBoardDto>(`/workspaces/${workspaceId}/dream-board`, {
      title,
    }),

  createPin: (workspaceId: string, input: Record<string, unknown>) =>
    http.post(`/workspaces/${workspaceId}/dream-board/pins`, input),

  updatePin: (
    workspaceId: string,
    pinId: string,
    input: Record<string, unknown>,
  ) =>
    http.patch(`/workspaces/${workspaceId}/dream-board/pins/${pinId}`, input),

  deletePin: (workspaceId: string, pinId: string) =>
    http.delete(`/workspaces/${workspaceId}/dream-board/pins/${pinId}`),
};
