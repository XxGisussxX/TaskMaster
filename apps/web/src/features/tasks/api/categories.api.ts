import type { Category } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const categoriesApi = {
  list: (workspaceId: string) =>
    http.get<Category[]>(`/workspaces/${workspaceId}/categories`),

  create: (workspaceId: string, input: { name: string; color?: string }) =>
    http.post<Category>(`/workspaces/${workspaceId}/categories`, input),

  update: (workspaceId: string, id: string, input: Record<string, unknown>) =>
    http.patch<Category>(`/workspaces/${workspaceId}/categories/${id}`, input),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(`/workspaces/${workspaceId}/categories/${id}`),
};
