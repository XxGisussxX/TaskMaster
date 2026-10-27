import {
  AlarmClock,
  CheckCircle2,
  Gauge,
  ListTodo,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "../hooks/useDashboard";
import { KpiCard } from "../components/KpiCard";
import { LineChart, ChartLegend } from "../components/LineChart";
import { DonutChart } from "../components/DonutChart";
import { Heatmap } from "../components/Heatmap";
import { TodaySummaryCard } from "../components/TodaySummaryCard";
import { UpcomingDeadlines } from "../components/UpcomingDeadlines";
import { TeamLoadCard } from "../components/TeamLoadCard";
import { AgendaOptimizationCard } from "../components/AgendaOptimizationCard";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { DashboardRangeSelector } from "../components/DashboardRangeSelector";
import { ThroughputCard } from "../components/ThroughputCard";
import { OverdueByAgeCard } from "../components/OverdueByAgeCard";
import { PersonLoadCard } from "../components/PersonLoadCard";
import { useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";
import { useCurrentMembership } from "@/features/workspace/hooks/useMembers";
import {
  defaultRange,
  formatLongToday,
  partOfDayGreeting,
  weekCompleted,
} from "../lib/dashboardStats";
import { Priority } from "@taskmaster/contracts";

type DashboardStatsLike = NonNullable<
  ReturnType<typeof useDashboardStats>["data"]
>;

export function DashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState(() => defaultRange());
  const { data, isLoading, isError, isFetching, refetch } =
    useDashboardStats(range);
  const user = useAuthStore((s) => s.user);
  const requestTaskModal = useUiStore((s) => s.requestTaskModal);
  const { canWrite } = useCurrentMembership();
  const overdueCritical = data?.kpis.overdueCritical ?? 0;

  const greeting = `${partOfDayGreeting()}, ${user?.name ?? "ahí"} 👋`;
  const summary = data
    ? `Tienes ${data.kpis.activeTasks.toLocaleString("es")} tareas pendientes y ${(
        data.priorityDistribution[Priority.URGENT] +
        data.priorityDistribution[Priority.HIGH]
      ).toLocaleString("es")} de prioridad crítica.`
    : undefined;

  const createTask = () => {
    navigate("/tasks");
    requestTaskModal({ mode: "create" });
  };

  if (isLoading) return <PageLoader />;

  if (isError || !data) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={greeting}
          description={formatTodayDescription(summary)}
          action={
            canWrite && (
              <Button onClick={createTask}>
                <Plus className="h-4 w-4" />
                Nueva tarea
              </Button>
            )
          }
        />
        <EmptyState
          title="Sin datos de analíticas"
          description="Aún no hay estadísticas para este workspace o la API no está disponible."
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          }
        />
        <TaskBasedBlocks />
      </div>
    );
  }

  const weekSums = weekCompleted(data.kpiTrends);
  const completedSeries = data.kpiTrends.map((t) => t.completed);

  return (
    <div className="space-y-5">
      <PageHeader
        title={greeting}
        description={formatTodayDescription(summary)}
        action={
          canWrite && (
            <Button onClick={createTask}>
              <Plus className="h-4 w-4" />
              Nueva tarea
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 p-3">
        <DashboardRangeSelector value={range} onChange={setRange} />
        {isFetching && (
          <p className="text-xs text-muted-foreground">Actualizando…</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tareas pendientes"
          value={data.kpis.activeTasks.toLocaleString("es")}
          icon={ListTodo}
          accent="primary"
          hint={trendHint(
            data.kpiTrends.map((t) => t.active),
            "pendientes",
          )}
          sparkline={data.kpiTrends.map((t) => t.active)}
        />
        <KpiCard
          label="Completadas esta semana"
          value={weekSums.current.toLocaleString("es")}
          icon={CheckCircle2}
          accent="success"
          hint={weekSumsHint(weekSums)}
          sparkline={completedSeries}
        />
        <KpiCard
          label="Vencidas"
          value={data.kpis.overdueTasks.toLocaleString("es")}
          icon={AlarmClock}
          accent="danger"
          hint={
            overdueCritical > 0
              ? `${overdueCritical} ${overdueCritical === 1 ? "crítica" : "críticas"}`
              : "Sin prioridades críticas vencidas"
          }
          sparkline={data.kpiTrends.map((t) => t.overdue)}
        />
        <KpiCard
          label="Tasa de completado"
          value={`${data.kpis.completionRate.toLocaleString("es")}%`}
          icon={Gauge}
          accent="warning"
          hint="sobre el total no archivado"
          sparkline={data.kpiTrends.map((t) => t.active)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" /> Creadas vs completadas
              </CardTitle>
              <ChartLegend />
            </CardHeader>
            <CardContent>
              <LineChart series={data.createdCompletedSeries} />
            </CardContent>
          </Card>

          {data.weeklyThroughput && data.weeklyThroughput.length > 0 && (
            <ThroughputCard data={data.weeklyThroughput} />
          )}

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">
                Próximas fechas límite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UpcomingDeadlines tasks={data.upcomingDeadlines ?? []} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">
                Equipo y sprint de trabajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TeamLoadCard teamLoad={data.teamLoad} />
            </CardContent>
          </Card>

          {data.workloadByPerson && data.hoursByPerson && (
            <PersonLoadCard
              workload={data.workloadByPerson}
              hours={data.hoursByPerson}
              currentUserId={user?.id}
            />
          )}

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Actividad anual</CardTitle>
            </CardHeader>
            <CardContent>
              <Heatmap
                data={data.heatmap ?? yearData(data)}
                year={new Date().getFullYear()}
              />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card className="flex overflow-hidden flex-col">
            <CardHeader>
              <CardTitle className="text-base">Por prioridad</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1">
              <DonutChart data={data.priorityDistribution} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Estado actual</CardTitle>
            </CardHeader>
            <CardContent>
              <TodaySummaryCard
                completedToday={data.kpis.completedToday}
                avgCompletionDays={data.kpis.avgCompletionDays}
                statusDistribution={data.statusDistribution}
              />
            </CardContent>
          </Card>

          {data.overdueByAge && data.overdueByAge.length > 0 && (
            <OverdueByAgeCard data={data.overdueByAge} />
          )}

          <AgendaOptimizationCard />

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Actividad reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline entries={data.activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Bloques que funcionan con datos de tareas reales, sin depender de las analíticas. */
function TaskBasedBlocks() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Próximas fechas límite</CardTitle>
        </CardHeader>
        <CardContent>
          <UpcomingDeadlines tasks={[]} />
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">
            Equipo y sprint de trabajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TeamLoadCard />
        </CardContent>
      </Card>
    </div>
  );
}

function formatTodayDescription(summary: string | undefined): string {
  const date = formatLongToday(new Date());
  return summary ? `Hoy es ${date}. ${summary}` : `Hoy es ${date}.`;
}

function yearData(dashboard: DashboardStatsLike) {
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

function trendHint(values: number[], unit: string) {
  if (values.length < 2) return `Último registro: ${values[0] ?? 0} ${unit}`;
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  const difference = last - first;
  if (difference === 0) return "Sin cambios en 30 días";
  return `${difference > 0 ? "+" : ""}${difference.toLocaleString("es")} vs. hace 30 días`;
}

function weekSumsHint(sums: { current: number; changePct: number }) {
  const sign = sums.changePct > 0 ? "+" : "";
  return `${sign}${sums.changePct}% vs. semana anterior`;
}
