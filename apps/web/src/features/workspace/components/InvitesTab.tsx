import {
  AlertTriangle,
  Mail,
  RefreshCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import {
  useCurrentMembership,
  usePendingInvites,
  useResendInvite,
  useRevokeInvite,
} from "../hooks/useMembers";
import { ROLE_LABELS } from "../lib/teamPermissions";

export function InvitesTab() {
  const { isOwnerOrAdmin } = useCurrentMembership();
  const { data: invites = [], isLoading, isError } = usePendingInvites();
  const resend = useResendInvite();
  const revoke = useRevokeInvite();
  const busy = resend.isPending || revoke.isPending;

  if (!isOwnerOrAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Solo administradores"
        description="Necesitas ser propietario o administrador para gestionar las invitaciones del workspace."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se pudieron cargar las invitaciones"
        description="Verifica la conexión con la API e inténtalo de nuevo."
      />
    );
  }

  if (invites.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Sin invitaciones pendientes"
        description="Cuando invites a alguien, el enlace aparecerá aquí hasta que lo acepte o venza."
      />
    );
  }

  const dateFormatter = new Intl.DateTimeFormat("es", { dateStyle: "medium" });

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">
        Invitaciones pendientes ({invites.length})
      </p>
      <ul className="divide-y rounded-md border">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-wrap items-center gap-3 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{invite.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ROLE_LABELS[invite.role]} · vence el{" "}
                {dateFormatter.format(new Date(invite.expiresAt))}
                {invite.invitedBy ? ` · invitó ${invite.invitedBy.name}` : ""}
              </p>
            </div>
            <Badge variant="secondary">
              <Mail className="mr-1 h-3 w-3" />
              Pendiente
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Reenviar invitación"
              disabled={busy}
              onClick={() => resend.mutate(invite.id)}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Revocar invitación"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(`¿Revocar la invitación de ${invite.email}?`)
                ) {
                  revoke.mutate(invite.id);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
