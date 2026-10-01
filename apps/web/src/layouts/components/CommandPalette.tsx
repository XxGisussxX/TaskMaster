import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  History,
  ListTodo,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui.store";
import { usePaletteRegistry } from "@/features/palette/registry";
import { usePaletteSearch } from "@/features/palette/search";
import {
  buildSections,
  itemKey,
  itemLabel,
  stepIndex,
  type PaletteItem,
  type PaletteSection,
} from "@/features/palette/model";
import {
  useRecentStore,
  RECENT_NOTE_TYPE_LABEL,
  RECENT_STATUS_LABEL,
  type RecentEntry,
} from "@/features/palette/recent";
import { NAV_ITEMS } from "@/app/nav";
import { tasksApi } from "@/features/tasks/api/tasks.api";
import { notesApi } from "@/features/notes/api/notes.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { formatRelativeTime } from "@/lib/date";

function itemIcon(item: PaletteItem): LucideIcon | null {
  if (item.kind === "command") return item.command.icon ?? null;
  if (item.kind === "task") return ListTodo;
  if (item.kind === "note") return StickyNote;
  const entry = item.entry;
  if (entry.kind === "route") {
    return NAV_ITEMS.find((nav) => nav.to === entry.path)?.icon ?? History;
  }
  return entry.kind === "task" ? ListTodo : StickyNote;
}

function recentSecondary(entry: RecentEntry): string | null {
  if (entry.kind === "task") {
    return `${RECENT_STATUS_LABEL[entry.status]} · ${formatRelativeTime(entry.updatedAt)}`;
  }
  if (entry.kind === "note") {
    return `${RECENT_NOTE_TYPE_LABEL[entry.type]} · ${formatRelativeTime(entry.updatedAt)}`;
  }
  return null;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const requestTaskModal = useUiStore((s) => s.requestTaskModal);
  const requestNoteOpen = useUiStore((s) => s.requestNoteOpen);
  const commandMap = usePaletteRegistry((s) => s.commands);
  const commands = useMemo(() => Object.values(commandMap), [commandMap]);
  const recent = useRecentStore((s) => s.entries);
  const recordRecent = useRecentStore((s) => s.record);
  const workspaceId = useCurrentWorkspaceId();
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

  const sections = useMemo<PaletteSection[]>(
    () =>
      buildSections(commands, query, {
        hasQuery: search.hasQuery,
        tasks: search.tasks,
        notes: search.notes,
        recent,
      }),
    [commands, query, search.hasQuery, search.tasks, search.notes, recent],
  );

  const flatItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, commands]);

  function handleRecentSelect(entry: RecentEntry) {
    recordRecent(entry);
    if (entry.kind === "route") {
      navigate(entry.path);
      return;
    }
    if (entry.kind === "task") {
      navigate("/tasks");
      if (!workspaceId) return;
      tasksApi.get(workspaceId, entry.id).then(
        (task) => requestTaskModal({ mode: "edit", task }),
        () => toast.error("La tarea ya no existe"),
      );
      return;
    }
    navigate("/notes");
    if (!workspaceId) return;
    notesApi.get(workspaceId, entry.id).then(
      (note) => requestNoteOpen(note),
      () => toast.error("La nota ya no existe"),
    );
  }

  function handleSelect(item: PaletteItem) {
    setOpen(false);
    if (item.kind === "command") {
      item.command.run();
      return;
    }
    if (item.kind === "task") {
      navigate("/tasks");
      recordRecent({
        kind: "task",
        id: item.task.id,
        title: item.task.title,
        status: item.task.status,
        updatedAt: item.task.updatedAt,
      });
      requestTaskModal({ mode: "edit", task: item.task });
      return;
    }
    if (item.kind === "note") {
      navigate("/notes");
      recordRecent({
        kind: "note",
        id: item.note.id,
        title: item.note.title ?? "Nota sin título",
        type: item.note.type,
        updatedAt: item.note.updatedAt,
      });
      return;
    }
    handleRecentSelect(item.entry);
  }

  let globalIndex = 0;
  const hasResults = flatItems.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Paleta de comandos"
      description="Navega, busca o crea rápido"
      className="max-w-2xl overflow-hidden bg-card p-0 text-card-foreground shadow-2xl [&>div:first-child]:hidden"
    >
      <div className="flex max-h-[min(38rem,calc(100vh-6rem))] flex-col">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={
              flatItems[activeIndex] ? `palette-item-${activeIndex}` : undefined
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => stepIndex(i, +1, flatItems.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => stepIndex(i, -1, flatItems.length));
              } else if (e.key === "Enter" && flatItems[activeIndex]) {
                handleSelect(flatItems[activeIndex]);
              }
            }}
            placeholder="Escribe un comando o busca tareas y notas..."
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar paleta de comandos"
            className="rounded text-lg leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ×
          </button>
        </div>

        <div
          id="palette-list"
          role="listbox"
          aria-label="Resultados de la paleta de comandos"
          className="flex-1 space-y-4 overflow-y-auto p-3"
        >
          {sections.map((section) => (
            <div key={section.title} role="group" aria-label={section.title}>
              <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const idx = globalIndex++;
                  const active = idx === activeIndex;
                  const Icon = itemIcon(item);
                  const secondary =
                    item.kind === "recent" ? recentSecondary(item.entry) : null;
                  return (
                    <button
                      key={itemKey(item)}
                      id={`palette-item-${idx}`}
                      role="option"
                      aria-selected={active}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-card-foreground transition-colors",
                        active
                          ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                          : "hover:bg-muted",
                      )}
                    >
                      {Icon && (
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col text-left">
                        <span className="truncate">{itemLabel(item)}</span>
                        {secondary && (
                          <span className="truncate text-xs text-muted-foreground">
                            {secondary}
                          </span>
                        )}
                      </span>
                      {item.kind === "command" && item.command.hint && (
                        <kbd
                          className={cn(
                            "ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[10px]",
                            active
                              ? "border-primary/20 bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {item.command.hint}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!hasResults && searching && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Buscando...
            </p>
          )}
          {!hasResults && !searching && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Sin resultados
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-medium">
                ↑
              </kbd>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-medium">
                ↓
              </kbd>
              navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-medium">
                ↵
              </kbd>
              seleccionar
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-medium">
                esc
              </kbd>
              cerrar
            </span>
          </div>
          <span className="font-medium">TaskMaster Command Engine</span>
        </div>
      </div>
    </Dialog>
  );
}
