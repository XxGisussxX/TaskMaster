import { useState } from "react";
import { UserPlus } from "lucide-react";
import { WorkspaceRole } from "@taskmaster/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useInviteMember, useCurrentMembership } from "../hooks/useMembers";
import { roleOptionsFor, ROLE_LABELS } from "../lib/teamPermissions";

export function MemberInviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { role } = useCurrentMembership();
  const invite = useInviteMember();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>(WorkspaceRole.MEMBER);

  const assignable = canManageMembersForInvite(role);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    invite.mutate(
      { email: email.trim(), role: inviteRole },
      {
        onSuccess: () => {
          setEmail("");
          setInviteRole(WorkspaceRole.MEMBER);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invitar miembro"
      description="Se enviará un correo con el enlace de invitación al workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {assignable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes permisos para invitar miembros en este workspace.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                disabled={invite.isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role">Rol</Label>
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                disabled={invite.isPending}
              >
                {assignable.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={
              invite.isPending || !email.trim() || assignable.length === 0
            }
          >
            <UserPlus className="h-4 w-4" />
            {invite.isPending ? "Enviando..." : "Invitar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function canManageMembersForInvite(
  role: WorkspaceRole | null,
): WorkspaceRole[] {
  if (role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN) {
    return roleOptionsFor(role, WorkspaceRole.MEMBER);
  }
  return [];
}
