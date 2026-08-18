import { useState } from "react";
import { ChevronDown, Check, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "../hooks/useWorkspaces";
import { useWorkspaceStore } from "@/store/workspace.store";

export function WorkspaceSwitcher({ sidebarOpen }: { sidebarOpen: boolean }) {
  const { data: workspaces = [] } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();
  const [open, setOpen] = useState(false);

  const current = workspaces.find((w) => w.id === currentWorkspaceId);

  if (!sidebarOpen || workspaces.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
          {current?.icon ?? current?.name?.charAt(0)?.toUpperCase() ?? "W"}
        </span>
        <span className="flex-1 truncate text-left font-medium">
          {current?.name ?? "Seleccionar workspace"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-card shadow-md">
            <div className="max-h-60 overflow-y-auto p-1">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => {
                    setCurrentWorkspaceId(workspace.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors",
                    workspace.id === currentWorkspaceId &&
                      "bg-accent font-medium",
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                    {workspace.icon ?? workspace.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-left">
                    {workspace.name}
                  </span>
                  {workspace.id === currentWorkspaceId && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t p-1">
              <a
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Gestionar workspaces
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
