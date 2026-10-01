import { create } from "zustand";
import type { LucideIcon } from "lucide-react";

export type PaletteGroup = "navigation" | "actions";

/** Sección de presentación: acciones rápidas o comandos del workspace. */
export type PaletteBucket = "quick" | "workspace";

export interface PaletteCommand {
  id: string;
  group: PaletteGroup;
  section: string;
  title: string;
  keywords?: string[];
  hint?: string;
  icon?: LucideIcon;
  run: () => void;
  /** Evalúa el contexto (p. ej. canWrite, workspace activo) antes de mostrar el comando. */
  available?: () => boolean;
  /**
   * Agrupación visual de la paleta. Por defecto "quick" (Acciones rápidas).
   * "workspace" agrupa el comando en "Comandos del workspace".
   */
  bucket?: PaletteBucket;
}

interface PaletteRegistryState {
  commands: Record<string, PaletteCommand>;
  registerCommand: (command: PaletteCommand) => void;
  unregisterCommand: (id: string) => void;
}

/** Registro dinámico de comandos de la paleta. Los features se suscriben vía register/unregister. */
export const usePaletteRegistry = create<PaletteRegistryState>((set) => ({
  commands: {},
  registerCommand: (command) =>
    set((state) => {
      const existing = state.commands[command.id];
      if (
        existing &&
        existing.run === command.run &&
        existing.title === command.title
      ) {
        return state;
      }
      return { commands: { ...state.commands, [command.id]: command } };
    }),
  unregisterCommand: (id) =>
    set((state) => {
      if (!(id in state.commands)) return state;
      const next = { ...state.commands };
      delete next[id];
      return { commands: next };
    }),
}));
