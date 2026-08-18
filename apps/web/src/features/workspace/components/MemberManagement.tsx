import { useState } from "react";
import type { WorkspaceMember } from "@taskmaster/contracts";
import {
  UserPlus,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/store/auth.store";
import {
  useMembers,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
} from "../hooks/useMembers";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MEMBER: "Miembro",
  VIEWER: "Observador",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  OWNER: <ShieldAlert className="h-3.5 w-3.5" />,
  ADMIN: <ShieldCheck className="h-3.5 w-3.5" />,
  MEMBER: <Shield className="h-3.5 w-3.5" />,
  VIEWER: <Shield className="h-3.5 w-3.5" />,
};

function InviteForm({ disabled }: { disabled?: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const inviteMutation = useInviteMember();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    inviteMutation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail("");
          setRole("MEMBER");
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor="invite-email" className="text-xs">
          Email
        </Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com"
          disabled={disabled || inviteMutation.isPending}
        />
      </div>
      <div className="w-36 space-y-1">
        <Label htmlFor="invite-role" className="text-xs">
          Rol
        </Label>
        <Select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={disabled || inviteMutation.isPending}
        >
          <option value="ADMIN">Administrador</option>
          <option value="MEMBER">Miembro</option>
          <option value="VIEWER">Observador</option>
        </Select>
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={disabled || inviteMutation.isPending || !email.trim()}
      >
        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
        Invitar
      </Button>
    </form>
  );
}

function MemberRow({
  member,
  isOwner,
  isCurrentUser,
  onRoleChange,
  onRemove,
  canManage,
}: {
  member: WorkspaceMember;
  isOwner: boolean;
  isCurrentUser: boolean;
  onRoleChange: (memberId: string, role: string) => void;
  onRemove: (memberId: string) => void;
  canManage: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <Avatar name={member.user?.name ?? "U"} src={member.user?.avatarUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {member.user?.name ?? "Usuario"}
          {isCurrentUser && (
            <span className="ml-1 text-xs text-muted-foreground">(tú)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {member.user?.email}
        </p>
      </div>
      {canManage && !isOwner ? (
        <Select
          value={member.role}
          onChange={(e) => onRoleChange(member.id, e.target.value)}
          className="w-36"
        >
          <option value="ADMIN">Administrador</option>
          <option value="MEMBER">Miembro</option>
          <option value="VIEWER">Observador</option>
        </Select>
      ) : (
        <Badge variant="secondary" className="gap-1">
          {ROLE_ICONS[member.role]}
          {ROLE_LABELS[member.role]}
        </Badge>
      )}
      {canManage && !isOwner && !isCurrentUser && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onRemove(member.id)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
    </div>
  );
}

export function MemberManagement() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: members = [], isLoading } = useMembers();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const currentMembership = members.find((m) => m.userId === currentUser?.id);
  const canManage =
    currentMembership?.role === "OWNER" || currentMembership?.role === "ADMIN";

  function handleRoleChange(memberId: string, role: string) {
    updateRole.mutate({ memberId, role });
  }

  function handleRemove(memberId: string) {
    if (window.confirm("¿Eliminar este miembro del workspace?")) {
      removeMember.mutate(memberId);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Miembros ({members.length})
      </h3>

      <div className="space-y-2">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isOwner={member.role === "OWNER"}
            isCurrentUser={member.userId === currentUser?.id}
            onRoleChange={handleRoleChange}
            onRemove={handleRemove}
            canManage={canManage}
          />
        ))}
      </div>

      {canManage && (
        <div className="pt-2 border-t">
          <h4 className="text-sm font-medium mb-2">Invitar miembro</h4>
          <InviteForm
            disabled={updateRole.isPending || removeMember.isPending}
          />
        </div>
      )}
    </div>
  );
}
