import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecentEntry } from "./recent";
import * as recentModule from "./recent";

let useRecentStore: typeof recentModule.useRecentStore;
let DEFAULT_RECENT: RecentEntry[];
let MAX_RECENT: number;

function createStorageShim() {
  const store = new Map<string, string>();
  return {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => void store.set(name, value),
    removeItem: (name: string) => void store.delete(name),
    clear: () => void store.clear(),
  };
}

function taskEntry(id: string, title = `Tarea ${id}`): RecentEntry {
  return {
    kind: "task",
    id,
    title,
    status: "TODO",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("features/palette/recent → historial de navegación", () => {
  beforeAll(async () => {
    vi.stubGlobal("window", { localStorage: createStorageShim() });
    ({ useRecentStore, DEFAULT_RECENT, MAX_RECENT } = await import("./recent"));
  });

  beforeEach(() => {
    useRecentStore.setState({ entries: DEFAULT_RECENT });
  });

  it("arranca con las rutas por defecto", () => {
    const { entries } = useRecentStore.getState();
    expect(entries).toHaveLength(4);
    expect(entries[0]?.kind).toBe("route");
    expect(entries.map((e) => (e.kind === "route" ? e.path : e.id))).toContain(
      "/tasks",
    );
  });

  it("record agrega una entrada al inicio", () => {
    useRecentStore.getState().record(taskEntry("t1"));
    const { entries } = useRecentStore.getState();
    expect(entries[0]).toEqual(taskEntry("t1"));
    expect(entries).toHaveLength(5);
  });

  it("record deduplica por tipo+id y traslada al inicio", () => {
    useRecentStore.getState().record(taskEntry("a"));
    useRecentStore.getState().record(taskEntry("b"));
    useRecentStore.getState().record(taskEntry("a"));

    const { entries } = useRecentStore.getState();
    expect(entries[0]?.id).toBe("a");
    expect(entries.filter((e) => e.kind === "task")).toHaveLength(2);
  });

  it("registra rutas distintas por su path (mismo recurso se reordena)", () => {
    useRecentStore.getState().record({
      kind: "route",
      id: "/calendar",
      label: "Calendario",
      path: "/calendar",
    });
    useRecentStore.getState().record({
      kind: "route",
      id: "/",
      label: "Dashboard",
      path: "/",
    });
    useRecentStore.getState().record({
      kind: "route",
      id: "/calendar",
      label: "Calendario",
      path: "/calendar",
    });

    const { entries } = useRecentStore.getState();
    expect(entries[0]?.id).toBe("/calendar");
    expect(entries.filter((e) => e.kind === "route")).toHaveLength(4);
  });

  it("respecta el tope MAX_RECENT al seguir registrando", () => {
    for (let i = 0; i < 15; i += 1) {
      useRecentStore.getState().record(taskEntry(`t${i}`));
    }
    const { entries } = useRecentStore.getState();
    expect(entries).toHaveLength(MAX_RECENT);
    expect(entries[0]?.id).toBe("t14");
  });

  it("remove elimina una entrada por tipo e id", () => {
    useRecentStore.getState().record(taskEntry("t1"));
    useRecentStore.getState().remove("task", "t1");

    const { entries } = useRecentStore.getState();
    expect(
      entries.find((e) => e.kind === "task" && e.id === "t1"),
    ).toBeUndefined();
  });

  it("clear vacía el historial", () => {
    useRecentStore.getState().clear();
    expect(useRecentStore.getState().entries).toEqual([]);
  });
});
