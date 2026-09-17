import {
  CheckCircle2,
  ListTodo,
  AlarmClock,
  Timer,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { useDashboardStats } from "../hooks/useDashboard";
import { KpiCard } from "../components/KpiCard";
import { LineChart, ChartLegend } from "../components/LineChart";
import { DonutChart } from "../components/DonutChart";
import { Heatmap } from "../components/Heatmap";
import { formatRelativeTime } from "@/lib/date";

export function DashboardPage() {
  const { data, isLoading, isError } = useDashboardStats();

  if (isLoading) return <PageLoader />;

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Resumen de tu actividad" />
        <EmptyState
          title="Sin datos disponibles"
          description="Aún no hay información para mostrar en este workspace."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Resumen de tu actividad" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tareas activas"
          value={data.kpis.activeTasks}
          icon={ListTodo}
          accent="primary"
        />
        <KpiCard
          label="Completadas hoy"
          value={data.kpis.completedToday}
          icon={CheckCircle2}
          accent="success"
        />
        <KpiCard
          label="Vencidas"
          value={data.kpis.overdueTasks}
          icon={AlarmClock}
          accent="danger"
        />
        <KpiCard
          label="Tiempo promedio"
          value={`${data.kpis.avgCompletionDays.toLocaleString("es")} días`}
          icon={Timer}
          accent="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="overflow-hidden xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Creadas vs completadas</CardTitle>
            <ChartLegend />
          </CardHeader>
          <CardContent>
            <LineChart series={data.createdCompletedSeries} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Por prioridad</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={data.priorityDistribution} />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Actividad anual</CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap data={yearData(data)} year={new Date().getFullYear()} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Actividad reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin actividad todavía
            </p>
          ) : (
            <ul className="space-y-2">
              {data.activity.slice(0, 10).map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 text-sm">
                  {entry.user ? (
                    <Avatar
                      name={entry.user.name}
                      src={entry.user.avatarUrl}
                      className="h-6 w-6 text-[10px]"
                    />
                  ) : null}
                  <span className="text-muted-foreground">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="font-medium">
                    {entry.entityType.toLowerCase()}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function yearData(dashboard: {
  createdCompletedSeries: {
    date: string;
    created: number;
    completed: number;
  }[];
}) {
  const year = new Date().getFullYear();
  const counts = new Map<string, number>();
  for (const point of dashboard.createdCompletedSeries) {
    if (point.date.startsWith(String(year))) {
      const key = point.date;
      counts.set(key, (counts.get(key) ?? 0) + point.created + point.completed);
    }
  }
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Creó",
  UPDATED: "Actualizó",
  COMPLETED: "Completó",
  REOPENED: "Reabrió",
  DELETED: "Eliminó",
  ASSIGNED: "Asignó",
};
