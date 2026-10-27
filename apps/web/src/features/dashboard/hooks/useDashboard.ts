import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardQuery, DashboardStats } from "@taskmaster/contracts";
import { dashboardApi } from "../api/dashboard.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { isLocalWorkspace } from "@/features/tasks/lib/localTasks";

/**
 * Datos del dashboard desde una única query. `query` (rango `from`/`to` y
 * `year`) va en la clave del caché y en la del socket se invalida el prefijo
 * `["dashboard", workspaceId]`, así los otros widgets sin rango siguen usando
 * su ventana por defecto.
 *
 * El segundo parámetro es un selector: React Query lo aplica al resultado y
 * solo vuelve a renderizar al consumidor cuando cambia la porción elegida. Los
 * widgets chicos (actividad, carga del equipo, KPIs del asistente) lo usan para
 * no re-renderizarse cuando se invalida el dashboard por un cambio que no ven.
 */
export function useDashboardStats<T = DashboardStats>(
  query: DashboardQuery = {},
  select?: (stats: DashboardStats) => T,
) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["dashboard", workspaceId, query],
    queryFn: () => dashboardApi.stats(workspaceId!, query),
    enabled: !!workspaceId && !isLocalWorkspace(workspaceId),
    // Al cambiar el rango se sigue mostrando la ventana anterior mientras
    // llega la nueva, en lugar de volver al loader de página completa.
    placeholderData: keepPreviousData,
    select,
  });
}

/** Registro de actividad: lo comparten la pestaña y el panel lateral. */
export const selectActivity = (stats: DashboardStats) => stats.activity;

/** Carga del equipo: la usa la tarjeta de KPIs del workspace. */
export const selectTeamLoad = (stats: DashboardStats) => stats.teamLoad;

/** Lo que necesita la página de workspace: carga del equipo y auditoría. */
export const selectWorkspaceOverview = (stats: DashboardStats) => ({
  teamLoad: stats.teamLoad,
  activity: stats.activity,
});

/** Los tres números con los que el asistente arma su mensaje proactivo. */
export const selectAssistantKpis = (stats: DashboardStats) => ({
  activeTasks: stats.kpis.activeTasks,
  overdueTasks: stats.kpis.overdueTasks,
  completedToday: stats.kpis.completedToday,
});
