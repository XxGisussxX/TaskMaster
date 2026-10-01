import type { Note, Task } from "@taskmaster/contracts";
import type { PaletteCommand } from "./registry";
import type { RecentEntry } from "./recent";
import { recentEntryId } from "./recent";

export type PaletteItem =
  | { kind: "command"; command: PaletteCommand }
  | { kind: "task"; task: Task }
  | { kind: "note"; note: Note }
  | { kind: "recent"; entry: RecentEntry };

export interface PaletteSection {
  title: string;
  items: PaletteItem[];
}

/** Resultados remotos (tareas/notas) ya resueltos y navegación reciente. */
export interface PaletteRemoteResults {
  hasQuery: boolean;
  tasks: Task[];
  notes: Note[];
  /** Historial local de navegación. Opcional para mantener compatibilidad. */
  recent?: RecentEntry[];
}

export const SECTION_QUICK = "Acciones rápidas";
export const SECTION_RECENT = "Navegación reciente";
export const SECTION_WORKSPACE = "Comandos del workspace";
export const SECTION_TASKS = "Tareas";
export const SECTION_NOTES = "Notas";

/** Filtrado local de comandos por título, sección o palabras clave. */
export function matchesCommand(command: PaletteCommand, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [command.title, command.section, ...(command.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return (
    command.title.toLowerCase().includes(needle) || haystack.includes(needle)
  );
}

export function itemKey(item: PaletteItem): string {
  if (item.kind === "command") return `cmd:${item.command.id}`;
  if (item.kind === "task") return `task:${item.task.id}`;
  if (item.kind === "note") return `note:${item.note.id}`;
  return `recent:${recentEntryId(item.entry)}`;
}

export function itemLabel(item: PaletteItem): string {
  if (item.kind === "command") return item.command.title;
  if (item.kind === "task") return item.task.title;
  if (item.kind === "note") return item.note.title ?? "Nota sin título";
  if (item.entry.kind === "route") return item.entry.label;
  return item.entry.title ?? "Sin título";
}

/**
 * Construye las secciones de la paleta en este orden:
 * Acciones rápidas → Navegación reciente → Comandos del workspace → Tareas → Notas.
 * La navegación reciente solo se muestra sin consulta activa.
 */
export function buildSections(
  commands: PaletteCommand[],
  query: string,
  remote: PaletteRemoteResults,
): PaletteSection[] {
  const q = query.trim().toLowerCase();
  const visible = commands.filter((c) => (c.available ? c.available() : true));
  const filtered = visible.filter((c) => matchesCommand(c, q));

  const toItem = (command: PaletteCommand): PaletteItem => ({
    kind: "command",
    command,
  });

  const out: PaletteSection[] = [];

  const quick = filtered.filter((c) => (c.bucket ?? "quick") === "quick");
  if (quick.length > 0) {
    out.push({ title: SECTION_QUICK, items: quick.map(toItem) });
  }

  if (!remote.hasQuery && remote.recent && remote.recent.length > 0) {
    out.push({
      title: SECTION_RECENT,
      items: remote.recent.map((entry) => ({ kind: "recent", entry })),
    });
  }

  const workspace = filtered.filter((c) => c.bucket === "workspace");
  if (workspace.length > 0) {
    out.push({
      title: SECTION_WORKSPACE,
      items: workspace.map(toItem),
    });
  }

  if (remote.hasQuery) {
    if (remote.tasks.length > 0) {
      out.push({
        title: SECTION_TASKS,
        items: remote.tasks.map((task) => ({ kind: "task", task })),
      });
    }
    if (remote.notes.length > 0) {
      out.push({
        title: SECTION_NOTES,
        items: remote.notes.map((note) => ({ kind: "note", note })),
      });
    }
  }

  return out;
}

/** Índice activo tras pulsar flecha arriba/abajo, acotado a [0, size-1]. */
export function stepIndex(
  current: number,
  delta: number,
  size: number,
): number {
  if (size <= 0) return 0;
  return Math.min(Math.max(current + delta, 0), size - 1);
}
