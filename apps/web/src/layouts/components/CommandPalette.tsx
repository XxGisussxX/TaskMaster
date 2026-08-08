import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "@/components/ui/dialog";
import { useUiStore } from "@/store/ui.store";
import { useFiltersStore } from "@/store/filters.store";

const ACTIONS = [
  { label: "Ir al Dashboard", hint: "G", to: "/" },
  { label: "Ir a Tareas", hint: "T", to: "/tasks" },
  { label: "Ir a Notas", hint: "N", to: "/notes" },
  { label: "Ir al Calendario", hint: "C", to: "/calendar" },
  { label: "Ir a Ajustes", hint: "S", to: "/settings" },
];

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setView = useFiltersStore((s) => s.setView);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = ACTIONS.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Paleta de comandos"
      description="Navega o crea rápido"
    >
      <div className="space-y-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered[0]) {
              handleSelect(filtered[0]);
            }
          }}
          placeholder="Buscar acción…"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.map((action) => (
            <button
              key={action.label}
              onClick={() => handleSelect(action)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <span>{action.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {action.hint}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Sin resultados
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );

  function handleSelect(action: (typeof ACTIONS)[number]) {
    setOpen(false);
    if (action.to === "/tasks") {
      setView("cards");
    }
    navigate(action.to);
  }
}
