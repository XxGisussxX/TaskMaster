import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useWorkspaces,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
} from "../hooks/useWorkspaces";
import { WorkspaceForm } from "./WorkspaceForm";
import { useWorkspaceStore } from "@/store/workspace.store";

export function WorkspaceManagement() {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const createWs = useCreateWorkspace();
  const updateWs = useUpdateWorkspace();
  const deleteWs = useDeleteWorkspace();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleCreate() {
    setEditingId(null);
    setFormOpen(true);
  }

  function handleEdit(id: string) {
    setEditingId(id);
    setFormOpen(true);
  }

  function handleDelete(id: string) {
    if (
      window.confirm(
        "¿Eliminar este workspace? Esta acción no se puede deshacer.",
      )
    ) {
      deleteWs.mutate(id);
    }
  }

  async function handleSubmit(values: { name: string; icon?: string }) {
    if (editingId) {
      await updateWs.mutateAsync({ id: editingId, input: values });
    } else {
      await createWs.mutateAsync(values);
    }
    setFormOpen(false);
  }

  const editingWorkspace = workspaces.find((w) => w.id === editingId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Nuevo
        </Button>
      </div>

      <div className="space-y-2">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className="flex items-center gap-3 rounded-md border px-3 py-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-sm font-bold text-primary">
              {ws.icon ?? ws.name.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{ws.name}</p>
              <p className="text-xs text-muted-foreground">{ws.slug}</p>
            </div>
            {ws.id === currentWorkspaceId && (
              <Badge variant="default" className="text-[10px]">
                Actual
              </Badge>
            )}
            {ws.ownerId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(ws.id)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {ws.ownerId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleDelete(ws.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <WorkspaceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultValues={
          editingWorkspace
            ? { name: editingWorkspace.name, icon: editingWorkspace.icon ?? "" }
            : undefined
        }
        onSubmit={handleSubmit}
        submitting={createWs.isPending || updateWs.isPending}
      />
    </div>
  );
}
