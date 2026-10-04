import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@taskmaster/contracts";

const STORAGE_KEY = "taskmaster.local.tasks";

function createStorageShim(initial: Record<string, unknown> = {}) {
  const store = new Map<string, string>([
    [STORAGE_KEY, JSON.stringify(initial)],
  ]);
  return {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => void store.set(name, value),
    removeItem: (name: string) => void store.delete(name),
    clear: () => void store.clear(),
  };
}

/**
 * Carga el módulo con un `localStorage` inyectado.
 *
 * `localStorage` no existe en el entorno node de Vitest, y el módulo lo lee al
 * importar. Se reimporta en cada test para que cada uno reciba su propio store.
 */
async function loadTasks(initial: Record<string, unknown> = {}) {
  vi.stubGlobal("localStorage", createStorageShim(initial));
  vi.resetModules();
  return import("./localTasks");
}

function legacyTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    workspaceId: "local-demo-workspace",
    creatorId: "local-demo-user",
    title: "Tarea vieja",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    startDate: null,
    order: 0,
    parentId: null,
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Desarrollo", color: "#3b82f6" },
    tags: [],
    assignees: [],
    subtasks: [],
    isRecurring: false,
    recurrence: null,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("localTasks → migración de Category a Channel", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("mapea categoryId y category de las tareas ya guardadas", async () => {
    const { listLocalTasks } = await loadTasks({
      "local-demo-workspace": [legacyTask()],
    });

    const [task] = listLocalTasks("local-demo-workspace").items;

    // Sin esto, el tipo prometería `channelId` y valdría undefined: el `?? null`
    // de los formularios lo convertiría en "sin canal" y el dato se perdía sin
    // que nada fallara.
    expect(task?.channelId).toBe("cat-1");
    expect(task?.channel).toEqual({
      id: "cat-1",
      name: "Desarrollo",
      color: "#3b82f6",
    });
  });

  it("respeta una tarea que ya está en el esquema nuevo", async () => {
    const { listLocalTasks } = await loadTasks({
      "local-demo-workspace": [
        legacyTask({
          categoryId: undefined,
          category: undefined,
          channelId: "ch-9",
          channel: { id: "ch-9", name: "Producto", color: null },
        }),
      ],
    });

    const [task] = listLocalTasks("local-demo-workspace").items;

    // La migración no debe pisar un canal nuevo con el valor legacy.
    expect(task?.channelId).toBe("ch-9");
    expect(task?.channel?.name).toBe("Producto");
  });

  it("deja en null una tarea que nunca tuvo categoría", async () => {
    const { listLocalTasks } = await loadTasks({
      "local-demo-workspace": [
        legacyTask({ categoryId: null, category: null }),
      ],
    });

    const [task] = listLocalTasks("local-demo-workspace").items;

    expect(task?.channelId).toBeNull();
    expect(task?.channel).toBeNull();
  });

  it("cae al store vacío si el JSON guardado está corrupto", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "{esto no es json",
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
    vi.resetModules();
    const { listLocalTasks } = await import("./localTasks");

    // El catch de readStore devuelve {} y el workspace se siembra en vez de romper.
    expect(listLocalTasks("local-demo-workspace").items).toHaveLength(1);
  });

  it("deja vacío el workspace si la lista guardada no es un array", async () => {
    const { listLocalTasks } = await loadTasks({
      "local-demo-workspace": "no es una lista",
    });

    expect(listLocalTasks("local-demo-workspace").items).toEqual([]);
  });

  it("reescribe las tareas viejas al guardar, sin dejar categoryId", async () => {
    const { createLocalTask } = await loadTasks({
      "local-demo-workspace": [legacyTask()],
    });

    createLocalTask("local-demo-workspace", { title: "Nueva" });

    const raw = JSON.parse(
      (globalThis.localStorage as Storage).getItem(STORAGE_KEY) ?? "{}",
    );
    const stored = raw["local-demo-workspace"] as Task[];

    // createLocalTask hace unshift, así que la tarea vieja queda en el índice 1.
    expect(stored[1]).toMatchObject({ channelId: "cat-1" });
    expect(stored[1]).not.toHaveProperty("categoryId");
  });
});
