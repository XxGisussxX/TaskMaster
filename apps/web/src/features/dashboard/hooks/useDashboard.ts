import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardQuery } from "@taskmaster/contracts";
import { dashboardApi } from "../api/dashboard.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { isLocalWorkspace } from "@/features/tasks/lib/localTasks";

/**
 * Datos del dashboard desde una única query. `query` (rango `from`/`to` y
 * `year`) va en la clave del caché y en la del socket se invalida el prefijo
 * `["dashboard", workspaceId]`, así los otros widgets sin rango siguen usando
 * su ventana por defecto.
 */
export function useDashboardStats(query: DashboardQuery = {}) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["dashboard", workspaceId, query],
    queryFn: () => dashboardApi.stats(workspaceId!, query),
    enabled: !!workspaceId && !isLocalWorkspace(workspaceId),
    // Al cambiar el rango se sigue mostrando la ventana anterior mientras
    // llega la nueva, en lugar de volver al loader de página completa.
    placeholderData: keepPreviousData,
  });
}
