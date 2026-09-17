import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Note, Task } from "@taskmaster/contracts";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui.store";
import {
  usePaletteRegistry,
  type PaletteCommand,
} from "@/features/palette/registry";
import { usePaletteSearch } from "@/features/palette/search";

type PaletteItem =
  | { kind: "command"; command: PaletteCommand }
  | { kind: "task"; task: Task }
  | { kind: "note"; note: Note };

interface PaletteSection {
  title: string;
  items: PaletteItem[];
}

function matchesCommand(command: PaletteCommand, q: string): boolean {
  if (!q) return true;
  const haystack = [command.title, command.section, ...(command.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return command.title.toLowerCase().includes(q) || haystack.includes(q);
}

function itemKey(item: PaletteItem): string {
  if (item.kind === "command") return `cmd:${item.command.id}`;
  if (item.kind === "task") return `task:${item.task.id}`;
  return `note:${item.note.id}`;
}

function itemLabel(item: PaletteItem): string {
  if (item.kind === "command") return item.command.title;
  if (item.kind === "task") return item.task.title;
  return item.note.title ?? "Nota sin título";
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const requestTaskModal = useUiStore((s) => s.requestTaskModal);
  const commands = usePaletteRegistry((s) => Object.values(s.commands));
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = usePaletteSearch(query);
  const { searching } = search;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const sections = useMemo<PaletteSection[]>(() => {
    const q = query.trim().toLowerCase();
    const visible = commands.filter((c) =>
      c.available ? c.available() : true,
    );
    const filtered = visible.filter((c) => matchesCommand(c, q));

    const nav = filtered.filter((c) => c.group === "navigation");
    const actions = filtered.filter((c) => c.group === "actions");

    const out: PaletteSection[] = [];
    if (nav.length > 0) {
      out.push({
        title: "Navegación",
        items: nav.map((command) => ({ kind: "command", command })),
      });
    }
    if (actions.length > 0) {
      out.push({
        title: "Acciones",
        items: actions.map((command) => ({ kind: "command", command })),
      });
    }
    if (search.hasQuery) {
      if (search.tasks.length > 0) {
        out.push({
          title: "Tareas",
          items: search.tasks.map((task) => ({ kind: "task", task })),
        });
      }
      if (search.notes.length > 0) {
        out.push({
          title: "Notas",
          items: search.notes.map((note) => ({ kind: "note", note })),
        });
      }
    }
    return out;
  }, [commands, query, search.hasQuery, search.tasks, search.notes]);

  const flatItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, commands]);

  function handleSelect(item: PaletteItem) {
    setOpen(false);
    if (item.kind === "command") {
      item.command.run();
      return;
    }
    if (item.kind === "task") {
      navigate("/tasks");
      requestTaskModal({ mode: "edit", task: item.task });
      return;
    }
    navigate("/notes");
  }

  let globalIndex = 0;
  const hasResults = flatItems.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Paleta de comandos"
      description="Navega, busca o crea rápido"
    >
      <div className="space-y-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && flatItems[activeIndex]) {
              handleSelect(flatItems[activeIndex]);
            }
          }}
          placeholder="Buscar acción o contenido…"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="max-h-72 overflow-y-auto space-y-3">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const idx = globalIndex++;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={itemKey(item)}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm",
                        active ? "bg-accent" : "hover:bg-accent/50",
                      )}
                    >
                      {item.kind === "command" && item.command.icon && (
                        <item.command.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{itemLabel(item)}</span>
                      {item.kind === "command" && item.command.hint && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {item.command.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!hasResults && searching && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
          )}
          {!hasResults && !searching && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Sin resultados
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
