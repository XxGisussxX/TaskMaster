import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  BadgeCheck,
  BadgeX,
} from "lucide-react";
import { SystemRole } from "@taskmaster/contracts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/store/auth.store";
import { ADMIN_PAGE_SIZE, type AdminUserRow } from "../api/admin.api";
import { useAdminUsers, useUpdateSystemRole } from "../hooks/useAdminUsers";

const ROLE_LABELS: Record<SystemRole, string> = {
  USER: "Usuario",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Super Admin",
};

const ROLE_ICONS: Record<SystemRole, React.ReactNode> = {
  USER: <Shield className="h-3.5 w-3.5" />,
  ADMIN: <ShieldCheck className="h-3.5 w-3.5" />,
  SUPER_ADMIN: <ShieldAlert className="h-3.5 w-3.5" />,
};

const dateFormatter = new Intl.DateTimeFormat("es", { dateStyle: "medium" });

function UserRow({
  user,
  isCurrentUser,
  isSuperAdmin,
  disabled,
  onRoleChange,
}: {
  user: AdminUserRow;
  isCurrentUser: boolean;
  isSuperAdmin: boolean;
  disabled: boolean;
  onRoleChange: (userId: string, role: SystemRole) => void;
}) {
  // Mismas reglas que AdminService.updateRole: solo SUPER_ADMIN modifica a
  // ADMIN/SUPER_ADMIN; el ADMIN solo toca USER. Nadie se modifica a sí mismo.
  const canEdit =
    !isCurrentUser && (isSuperAdmin || user.role === SystemRole.USER);
  const options: SystemRole[] = isSuperAdmin
    ? [SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
    : [SystemRole.USER, SystemRole.ADMIN];

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <Avatar name={user.name} src={null} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {user.name}
          {isCurrentUser && (
            <span className="ml-1 text-xs text-muted-foreground">(tú)</span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        {user.isEmailVerified ? (
          <Badge variant="success" className="gap-1">
            <BadgeCheck className="h-3 w-3" />
            Verificado
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1">
            <BadgeX className="h-3 w-3" />
            Sin verificar
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {dateFormatter.format(new Date(user.createdAt))}
        </span>
      </div>
      {canEdit ? (
        <Select
          value={user.role}
          disabled={disabled}
          className="w-40"
          onChange={(e) => onRoleChange(user.id, e.target.value as SystemRole)}
        >
          {options.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      ) : (
        <Badge variant="secondary" className="w-40 justify-center gap-1">
          {ROLE_ICONS[user.role]}
          {ROLE_LABELS[user.role]}
        </Badge>
      )}
    </div>
  );
}

export function AdminPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === SystemRole.SUPER_ADMIN;
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsers(page, ADMIN_PAGE_SIZE);
  const updateRole = useUpdateSystemRole();

  const users = data?.items ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / ADMIN_PAGE_SIZE),
  );

  function handleRoleChange(userId: string, role: SystemRole) {
    updateRole.mutate({ userId, role });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Administración"
        description="Gestión de roles de plataforma (USER / ADMIN / SUPER_ADMIN)"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Usuarios ({data?.total ?? "…"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin usuarios
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isCurrentUser={user.id === currentUser?.id}
                  isSuperAdmin={isSuperAdmin}
                  disabled={updateRole.isPending}
                  onRoleChange={handleRoleChange}
                />
              ))}
            </div>
          )}
        </CardContent>
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="Página siguiente"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
