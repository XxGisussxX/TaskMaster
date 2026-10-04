import { useMemo, useState } from "react";
import {
  Download,
  FolderKanban,
  ListTodo,
  Radio,
  UserPlus,
  Users,
  WifiOff,
} from "lucide-react";
import { WorkspaceRole } from "@taskmaster/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  useTasks,
  useCurrentWorkspaceId,
} from "@/features/tasks/hooks/useTasks";
import { useWorkspaces } from "../hooks/useWorkspaces";
import { useCurrentMembership, useMembers } from "../hooks/useMembers";
import { useDashboardStats } from "@/features/dashboard/hooks/useDashboard";
import { computeTeamLoad } from "@/features/dashboard/lib/dashboardStats";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { MemberInviteDialog } from "../components/MemberInviteDialog";
import { MembersTable } from "../components/MembersTable";
import { InvitesTab } from "../components/InvitesTab";
import { PermissionsTab } from "../components/PermissionsTab";
import { ActivityTab } from "../components/ActivityTab";
import { SidePanel } from "../components/SidePanel";
import { canManageMembers, ROLE_LABELS } from "../lib/teamPermissions";
import { exportAuditCsv } from "../lib/auditExport";

type TabId = "members" | "invites" | "permissions" | "activity";

const TABS: { id: TabId; label: string }[] = [
  { id: "members", label: "Miembros y roles" },
  { id: "invites", label: "Invitaciones pendientes" },
  { id: "permissions", label: "Permisos y grupos" },
  { id: "activity", label: "Registro de actividad" },
];

export function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<TabId>("members");
  const [inviteOpen, setInviteOpen] = useState(false);
  const workspaceId = useCurrentWorkspaceId();
  const user = useAuthStore((s) => s.user);
  const { data } = useWorkspaces();
  const { data: members = [], isLoading, isError } = useMembers();
  const { role } = useCurrentMembership();
  const { data: tasksData } = useTasks({ pageSize: 200 });
  const { data: dashboard } = useDashboardStats();
  const workspace = data?.find((w) => w.id === workspaceId);

  const team = useMemo(
    () => computeTeamLoad(tasksData?.items ?? [], members, user?.id),
    [tasksData, members, user?.id],
  );
  const managers = useMemo(
    () =>
      members.filter(
        (m) => m.role === WorkspaceRole.OWNER || m.role === WorkspaceRole.ADMIN,
      ).length,
    [members],
  );
  const canManage = canManageMembers(role);

  const hasActivity = !!dashboard && dashboard.activity.length > 0;

  const handleExport = () => {
    if (!hasActivity || !dashboard) return;
    exportAuditCsv(dashboard.activity, workspace?.name ?? "workspace");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workspace & Team"
        description={
          workspace
            ? `${workspace.name} · ${role ? ROLE_LABELS[role] : "sin rol"}`
            : "Gestiona el equipo, los roles y la actividad del workspace."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={!hasActivity}
              title={
                hasActivity
                  ? "Descargar el registro de auditoría (CSV)"
                  : "El registro de auditoría requiere datos de actividad"
              }
            >
              <Download className="h-4 w-4" />
              Exportar auditoría
            </Button>
            {canManage && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Invitar miembro
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Miembros del equipo"
          value={isLoading ? "—" : members.length.toLocaleString("es")}
          icon={Users}
          accent="primary"
          hint={
            isError
              ? "No se pudo consultar la API"
              : `${managers} con permisos de gestión`
          }
        />
        <KpiCard
          label="Activos ahora"
          value="—"
          icon={Radio}
          accent="success"
          hint="Presencia requiere sockets de presencia (pendiente)"
        />
        <KpiCard
          label="Carga operativa"
          value={team.totalOpen.toLocaleString("es")}
          icon={ListTodo}
          accent="warning"
          hint={`${team.totalOpen} abiertas · ${team.unassignedOpen} sin asignar`}
        />
        <KpiCard
          label="Canales de proyecto"
          value="—"
          icon={FolderKanban}
          accent="primary"
          hint="Entidad de canales pendiente en el backend"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" /> Equipo del workspace
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkspaceTabs
                active={activeTab}
                onChange={setActiveTab}
                membersCount={isLoading ? undefined : members.length}
              />
              <div
                className="pt-4"
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
              >
                {activeTab === "members" && (
                  <MembersTable
                    members={members}
                    isLoading={isLoading}
                    isError={isError}
                    onInvite={canManage ? () => setInviteOpen(true) : undefined}
                  />
                )}
                {activeTab === "invites" && <InvitesTab />}
                {activeTab === "permissions" && <PermissionsTab />}
                {activeTab === "activity" && <ActivityTab />}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <SidePanel />
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <WifiOff className="h-3.5 w-3.5" />
        Los espacios marcados como pendiente se activarán cuando exista el
        backend correspondiente; los datos mostrados son reales.
      </p>

      <MemberInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function WorkspaceTabs({
  active,
  onChange,
  membersCount,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
  membersCount?: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Secciones del workspace"
      className="flex flex-wrap items-center gap-1 border-b"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={active === tab.id ? `panel-${tab.id}` : undefined}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={cn(
            "-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === tab.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.id === "members" &&
            membersCount !== undefined &&
            ` (${membersCount})`}
        </button>
      ))}
    </div>
  );
}
