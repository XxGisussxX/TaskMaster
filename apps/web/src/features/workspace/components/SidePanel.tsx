import { FolderKanban, Radio, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActivityTimeline } from "@/features/dashboard/components/ActivityTimeline";
import { useDashboardStats } from "@/features/dashboard/hooks/useDashboard";

export function SidePanel() {
  return (
    <div className="space-y-4">
      <HuddleCard />
      <RecentActivityCard />
      <ProjectChannelsCard />
    </div>
  );
}

function HuddleCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-4 w-4" /> Huddle de equipo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={Radio}
          title="Preparado"
          description="La sala de reunión se activará cuando exista presencia en tiempo real (sockets de presencia) en el backend."
          action={
            <span className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Pendiente de backend
            </span>
          }
        />
      </CardContent>
    </Card>
  );
}

function RecentActivityCard() {
  const { data } = useDashboardStats();

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Actividad reciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.activity.length > 0 ? (
          <ActivityTimeline entries={data.activity} limit={8} />
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Sin actividad registrada todavía.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectChannelsCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderKanban className="h-4 w-4" /> Canales de proyecto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={FolderKanban}
          title="Sin proyectos"
          description="La entidad de canales/proyectos aún no existe en el backend. Las tareas se organizan hoy por categoría y prioridad."
          action={
            <span className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Pendiente de backend
            </span>
          }
        />
      </CardContent>
    </Card>
  );
}
