import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SubtaskDraft {
  id: string;
  title: string;
}

export function SubtaskList({
  subtasks,
  existingSubtasks,
  onChange,
}: {
  subtasks: SubtaskDraft[];
  existingSubtasks?: { id: string; title: string }[];
  onChange: (subtasks: SubtaskDraft[]) => void;
}) {
  const [newTitle, setNewTitle] = useState("");

  function addSubtask() {
    const title = newTitle.trim();
    if (!title) return;
    onChange([...subtasks, { id: crypto.randomUUID(), title }]);
    setNewTitle("");
  }

  function removeSubtask(id: string) {
    onChange(subtasks.filter((s) => s.id !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubtask();
    }
  }

  const hasAny = subtasks.length > 0 || (existingSubtasks?.length ?? 0) > 0;

  return (
    <div className="space-y-2">
      {existingSubtasks && existingSubtasks.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Subtareas existentes
          </p>
          {existingSubtasks.map((st) => (
            <div
              key={st.id}
              className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{st.title}</span>
            </div>
          ))}
        </div>
      )}

      {subtasks.map((st) => (
        <div
          key={st.id}
          className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1 truncate">{st.title}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => removeSubtask(st.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nueva subtarea…"
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSubtask}
          disabled={!newTitle.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!hasAny && (
        <p className="text-xs text-muted-foreground">
          Sin subtareas. Escribe un título y presiona Enter para agregar.
        </p>
      )}
    </div>
  );
}
