import { useQuery } from "@tanstack/react-query";
import { http } from "@/services/http";
import type { AgendaReview } from "@taskmaster/contracts";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { isLocalWorkspace } from "@/features/tasks/lib/localTasks";

export const agendaApi = {
  review: (workspaceId: string) =>
    http.get<AgendaReview>(`/workspaces/${workspaceId}/agenda-review`),
};

/**
 * Revisión de agenda del workspace activo.
 *
 * `refetchOnWindowFocus` apagado a propósito: es un diagnóstico, no un contador
 * vivo, y refocusar la pestaña re-contaba todo el workspace para volver a pintar
 * la misma lista. Los eventos de socket que invalidan tareas sí la refrescan, así
 * que el diagnóstico no queda viejo si alguien mueve una tarea.
 */
export function useAgendaReview() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["agenda-review", workspaceId],
    queryFn: () => agendaApi.review(workspaceId!),
    enabled: !!workspaceId && !isLocalWorkspace(workspaceId),
    refetchOnWindowFocus: false,
  });
}
