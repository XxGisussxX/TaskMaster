import { FolderKanban, Radio, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActivityTimeline } from "@/features/dashboard/components/ActivityTimeline";
import { useDashboardStats } from "@/features/dashboard/hooks/useDashboard";
import { useMembers } from "../hooks/useMembers";
import { usePresenceStore } from "@/store/presence.store";
import { Avatar } from "@/components/ui/avatar";

export function SidePanel() {
  return (
    <div className="space-y-4">
      <HuddleCard />
      <RecentActivityCard />
      <ProjectChannelsCard />
    </div>
  );
}

/**
 * Quién está conectado ahora.
 *
 * Se cruza el snapshot con la lista de miembros para mostrar nombre y avatar:
 * el servidor solo manda ids, porque resolverlos ahí duplicaría datos que el
 * cliente ya tiene cacheados.
 */
function HuddleCard() {
  const { activeUserIds, activeCount, ready } = usePresenceStore();
  const { data: members = [] } = useMembers();

  const active = activeUserIds
    .map((id) => members.find((m) => m.userId === id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-4 w-4" /> Huddle de equipo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Conectando al canal de presencia…
          </p>
        ) : active.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Nadie conectado ahora mismo.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((m) => (
              <li key={m.userId} className="flex items-center gap-2.5">
                <Avatar
                  name={m.user?.name ?? m.user?.email ?? "Miembro"}
                  src={m.user?.avatarUrl ?? null}
                  className="h-7 w-7"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.user?.name ?? m.user?.email ?? "Miembro"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.role.toLowerCase()}
                  </p>
                </div>
                <span
                  className="ml-auto h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                  aria-label="Conectado"
                />
              </li>
            ))}
          </ul>
        )}
        {ready && activeCount > 0 && (
          <p className="pt-3 text-xs text-muted-foreground">
            {activeCount === active.length
              ? `${activeCount} ${activeCount === 1 ? "persona conectada" : "personas conectadas"}`
              : `${activeCount} conectadas · ${active.length} en este equipo`}
          </p>
        )}
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
