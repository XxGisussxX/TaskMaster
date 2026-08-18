import { useState } from "react";
import { Bookmark, Plus, X } from "lucide-react";
import type { SavedView } from "@taskmaster/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFiltersStore } from "@/store/filters.store";
import {
  useSavedViews,
  useCreateSavedView,
  useDeleteSavedView,
} from "../hooks/useSavedViews";

export function SavedViewBar() {
  const filters = useFiltersStore();
  const { data: views } = useSavedViews();
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");

  const activeFilters = {
    status: filters.status,
    priority: filters.priority,
    search: filters.search,
    onlyMine: filters.onlyMine,
    onlyOverdue: filters.onlyOverdue,
  };

  const hasActiveFilters =
    filters.status !== "ALL" ||
    filters.priority !== "ALL" ||
    filters.search !== "" ||
    filters.onlyMine ||
    filters.onlyOverdue;

  const handleSave = () => {
    if (!newName.trim()) return;
    createView.mutate({
      name: newName.trim(),
      filters: activeFilters,
      view: filters.view,
    });
    setNewName("");
    setEditing(false);
  };

  const handleApply = (view: SavedView) => {
    const f = view.filters;
    if (f.status) filters.setStatus(f.status as typeof filters.status);
    else filters.setStatus("ALL");
    if (f.priority) filters.setPriority(f.priority as typeof filters.priority);
    else filters.setPriority("ALL");
    if (f.search) filters.setSearch(f.search as string);
    else filters.setSearch("");
    if (f.onlyMine !== undefined) {
      if (f.onlyMine !== filters.onlyMine) filters.toggleOnlyMine();
    } else if (filters.onlyMine) {
      filters.toggleOnlyMine();
    }
    if (f.onlyOverdue !== undefined) {
      if (f.onlyOverdue !== filters.onlyOverdue) filters.toggleOnlyOverdue();
    } else if (filters.onlyOverdue) {
      filters.toggleOnlyOverdue();
    }
    if (view.view) filters.setView(view.view as typeof filters.view);
  };

  return (
    <div className="flex items-center gap-2">
      <Bookmark className="h-4 w-4 text-muted-foreground" />

      {views && views.length > 0 && (
        <div className="flex items-center gap-1">
          {views.map((view) => (
            <div key={view.id} className="group relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleApply(view)}
              >
                {view.name}
              </Button>
              <button
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:inline-flex"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`¿Eliminar la vista "${view.name}"?`)) {
                    deleteView.mutate(view.id);
                  }
                }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {hasActiveFilters && !editing && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setEditing(true)}
        >
          <Plus className="h-3 w-3" />
          Guardar vista
        </Button>
      )}

      {editing && (
        <div className="flex items-center gap-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la vista"
            className="h-7 w-40 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSave}>
            Guardar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setEditing(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
