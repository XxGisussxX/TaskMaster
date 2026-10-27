import { AlertTriangle, History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { ActivityTimeline } from "@/features/dashboard/components/ActivityTimeline";
import {
  selectActivity,
  useDashboardStats,
} from "@/features/dashboard/hooks/useDashboard";

export function ActivityTab() {
  const {
    data: activity,
    isLoading,
    isError,
  } = useDashboardStats({}, selectActivity);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (isError || !activity) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Registro de actividad no disponible"
        description="La actividad proviene de la API del dashboard. Conecta un workspace real para verla."
      />
    );
  }

  if (activity.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sin actividad registrada"
        description="Las acciones del equipo aparecerán aquí a medida que ocurran."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ActivityTimeline entries={activity} limit={30} />
      <p className="text-[11px] text-muted-foreground">
        Últimas {Math.min(30, activity.length)} acciones del workspace.
      </p>
    </div>
  );
}
