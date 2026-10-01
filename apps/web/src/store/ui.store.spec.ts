import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as uiStoreModule from "./ui.store";

let useUiStore: typeof uiStoreModule.useUiStore;

function createStorageShim() {
  const store = new Map<string, string>();
  return {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => void store.set(name, value),
    removeItem: (name: string) => void store.delete(name),
    clear: () => void store.clear(),
  };
}

describe("store/ui → apertura y cierre de la paleta", () => {
  beforeAll(async () => {
    vi.stubGlobal("window", { localStorage: createStorageShim() });
    ({ useUiStore } = await import("./ui.store"));
  });

  beforeEach(() => {
    useUiStore.setState({
      commandPaletteOpen: false,
      sidebarOpen: false,
      taskModalRequest: null,
      noteCreateRequest: false,
    });
  });

  it("la paleta arranca cerrada", () => {
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("setCommandPaletteOpen(true) abre la paleta", () => {
    useUiStore.getState().setCommandPaletteOpen(true);
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
  });

  it("setCommandPaletteOpen(false) cierra la paleta", () => {
    useUiStore.getState().setCommandPaletteOpen(true);
    useUiStore.getState().setCommandPaletteOpen(false);
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("abrir o cerrar la paleta no altera el resto del estado de UI", () => {
    useUiStore.setState({ sidebarOpen: true });
    useUiStore.getState().setCommandPaletteOpen(true);

    const state = useUiStore.getState();
    expect(state.sidebarOpen).toBe(true);
    expect(state.noteCreateRequest).toBe(false);
    expect(state.taskModalRequest).toBeNull();
    expect(state.commandPaletteOpen).toBe(true);
  });
});
