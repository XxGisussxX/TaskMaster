import { describe, expect, it, vi } from "vitest";
import type { Note, Task } from "@taskmaster/contracts";
import type { PaletteCommand } from "./registry";
import type { RecentEntry } from "./recent";
import {
  buildSections,
  itemKey,
  itemLabel,
  matchesCommand,
  stepIndex,
  type PaletteItem,
  type PaletteRemoteResults,
} from "./model";

function commandIds(items: PaletteItem[]): string[] {
  return items
    .filter(
      (i): i is Extract<PaletteItem, { kind: "command" }> =>
        i.kind === "command",
    )
    .map((i) => i.command.id);
}

function makeCommand(overrides: Partial<PaletteCommand> = {}): PaletteCommand {
  return {
    id: "cmd.test",
    group: "actions",
    section: "Prueba",
    title: "Comando de prueba",
    keywords: ["crear", "test"],
    run: () => undefined,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    workspaceId: "ws-1",
    creatorId: "user-1",
    title: "Tarea de ejemplo",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    startDate: null,
    order: 0,
    parentId: null,
    categoryId: null,
    tags: [],
    assignees: [],
    subtasks: [],
    isRecurring: false,
    recurrence: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    workspaceId: "ws-1",
    authorId: "user-1",
    type: "STANDARD",
    title: "Nota de ejemplo",
    content: null,
    color: null,
    pinned: false,
    tags: [],
    items: [],
    collaborators: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const emptyRemote: PaletteRemoteResults = {
  hasQuery: false,
  tasks: [],
  notes: [],
};

const recentRoute: RecentEntry = {
  kind: "route",
  id: "/tasks",
  label: "Tareas",
  path: "/tasks",
};

const recentTask: RecentEntry = {
  kind: "task",
  id: "t-recent",
  title: "Tarea reciente",
  status: "IN_PROGRESS",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("palette/model → matchesCommand (filtrado local)", () => {
  it("devuelve true con consulta vacía", () => {
    const command = makeCommand();
    expect(matchesCommand(command, "")).toBe(true);
    expect(matchesCommand(command, "   ")).toBe(true);
  });

  it("coincide por título ignorando mayúsculas/minúsculas", () => {
    const command = makeCommand({ title: "Nueva tarea" });
    expect(matchesCommand(command, "nueva")).toBe(true);
    expect(matchesCommand(command, "NUEVA")).toBe(true);
    expect(matchesCommand(command, "tarea")).toBe(true);
  });

  it("coincide por keywords y por sección", () => {
    const command = makeCommand({ keywords: ["gemini", "borrador"] });
    expect(matchesCommand(command, "gemini")).toBe(true);
    expect(matchesCommand(command, "Prueba")).toBe(true);
  });

  it("no coincide si la consulta no aparece en ningún campo", () => {
    const command = makeCommand({ title: "Nueva tarea", keywords: ["crear"] });
    expect(matchesCommand(command, "inexistente")).toBe(false);
  });

  it("recorta espacios en blanco de la consulta", () => {
    const command = makeCommand({ title: "Nueva tarea" });
    expect(matchesCommand(command, "  nueva  ".trim())).toBe(true);
  });
});

describe("palette/model → buildSections (agrupación y búsqueda vacía)", () => {
  it("con consulta vacía agrupa por defecto todos los comandos en Acciones rápidas", () => {
    const nav = makeCommand({
      id: "nav.one",
      group: "navigation",
      title: "Ir a Tareas",
      section: "Navegación",
    });
    const actionA = makeCommand({ id: "act.a", title: "Nueva tarea" });
    const actionB = makeCommand({ id: "act.b", title: "Nueva nota" });

    const sections = buildSections([actionA, nav, actionB], "", emptyRemote);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Acciones rápidas");
    expect(commandIds(sections[0]?.items ?? [])).toEqual([
      "act.a",
      "nav.one",
      "act.b",
    ]);
  });

  it("agrupa comandos con bucket workspace en Comandos del workspace", () => {
    const quick = makeCommand({ id: "act.quick", title: "Nueva tarea" });
    const workspace = makeCommand({
      id: "ws.invite",
      bucket: "workspace",
      title: "Invitar miembros al workspace",
    });

    const sections = buildSections([quick, workspace], "", emptyRemote);

    const titles = sections.map((s) => s.title);
    expect(titles).toEqual(["Acciones rápidas", "Comandos del workspace"]);
  });

  it("muestra Navegación reciente sin consulta y la omite con consulta activa", () => {
    const command = makeCommand({ id: "act.quick", title: "Nueva tarea" });

    const withoutQuery = buildSections([command], "", {
      ...emptyRemote,
      recent: [recentRoute, recentTask],
    });
    expect(withoutQuery.map((s) => s.title)).toEqual([
      "Acciones rápidas",
      "Navegación reciente",
    ]);
    expect(withoutQuery[1]?.items).toEqual([
      { kind: "recent", entry: recentRoute },
      { kind: "recent", entry: recentTask },
    ]);

    const withQuery = buildSections([command], "nueva", {
      hasQuery: true,
      tasks: [],
      notes: [],
      recent: [recentRoute],
    });
    expect(withQuery.map((s) => s.title)).toEqual(["Acciones rápidas"]);
  });

  it("respeta el orden sin consulta: Acciones rápidas → Navegación reciente → Comandos del workspace", () => {
    const quick = makeCommand({ id: "act.quick", title: "Nueva tarea" });
    const ws = makeCommand({
      id: "ws.x",
      bucket: "workspace",
      title: "Invitar miembros",
    });

    const sections = buildSections([ws, quick], "", {
      ...emptyRemote,
      recent: [recentRoute],
    });

    expect(sections.map((s) => s.title)).toEqual([
      "Acciones rápidas",
      "Navegación reciente",
      "Comandos del workspace",
    ]);
  });

  it("respeta el orden con consulta: Acciones rápidas → Comandos del workspace → Tareas → Notas", () => {
    const quick = makeCommand({ id: "act.quick", title: "Nueva tarea" });
    const ws = makeCommand({
      id: "ws.x",
      bucket: "workspace",
      title: "Invitar miembros",
      keywords: ["nueva"],
    });
    const task = makeTask({ title: "Enviar informe" });
    const note = makeNote({ title: "Ideas de sprint" });

    const sections = buildSections([ws, quick], "nueva", {
      hasQuery: true,
      tasks: [task],
      notes: [note],
      recent: [recentRoute],
    });

    expect(sections.map((s) => s.title)).toEqual([
      "Acciones rápidas",
      "Comandos del workspace",
      "Tareas",
      "Notas",
    ]);
  });

  it("excluye comandos cuya evaluación available() devuelve false", () => {
    const hidden = makeCommand({ available: () => false });
    const shown = makeCommand({ id: "act.shown" });

    const sections = buildSections([hidden, shown], "", emptyRemote);

    expect(sections.flatMap((s) => s.items)).toHaveLength(1);
    expect(commandIds(sections[0]?.items ?? [])).toEqual(["act.shown"]);
  });

  it("filtra comandos localmente por la consulta", () => {
    const matchByTitle = makeCommand({ id: "act.title", title: "Nueva tarea" });
    const matchByKeyword = makeCommand({
      id: "act.keyword",
      title: "Crear con IA",
      keywords: ["gemini"],
    });
    const nomatch = makeCommand({ id: "act.no", title: "Tema oscuro" });

    const sections = buildSections(
      [matchByTitle, matchByKeyword, nomatch],
      "nueva",
      emptyRemote,
    );

    expect(commandIds(sections.flatMap((s) => s.items))).toEqual(["act.title"]);
  });

  it("sin coincidencias locales ni remotas devuelve secciones vacías", () => {
    const command = makeCommand({ title: "Nueva tarea" });
    const sections = buildSections([command], "zzz", {
      hasQuery: true,
      tasks: [],
      notes: [],
    });

    expect(sections).toEqual([]);
  });

  it("sin comandos y sin consulta devuelve secciones vacías (estado Sin resultados)", () => {
    const sections = buildSections([], "", emptyRemote);
    expect(sections).toEqual([]);
  });

  it("no inserta secciones de Tareas/Notas ni recientes sin consulta suficiente", () => {
    const command = makeCommand();
    const sections = buildSections([command], "", {
      hasQuery: false,
      tasks: [makeTask()],
      notes: [makeNote()],
      recent: [],
    });

    const titles = sections.map((s) => s.title);
    expect(titles).toEqual(["Acciones rápidas"]);
  });

  it("inserta secciones de Tareas y Notas con consulta suficiente y resultados", () => {
    const task = makeTask({ title: "Enviar informe" });
    const note = makeNote({ title: "Ideas de sprint" });

    const sections = buildSections([], "informe", {
      hasQuery: true,
      tasks: [task],
      notes: [note],
    });

    const titles = sections.map((s) => s.title);
    expect(titles).toEqual(["Tareas", "Notas"]);
    expect(sections[0]?.items[0]).toEqual({ kind: "task", task });
    expect(sections[1]?.items[0]).toEqual({ kind: "note", note });
  });

  it("omite la sección de Tareas/Notas cuando no hay resultados de ese tipo", () => {
    const sections = buildSections([], "informe", {
      hasQuery: true,
      tasks: [],
      notes: [makeNote()],
    });

    expect(sections.map((s) => s.title)).toEqual(["Notas"]);
  });
});

describe("palette/model → stepIndex (navegación con teclado)", () => {
  it("con lista vacía se mantiene en 0 (sin caer a -1)", () => {
    expect(stepIndex(0, +1, 0)).toBe(0);
    expect(stepIndex(0, -1, 0)).toBe(0);
  });

  it("ArrowUp en el primer elemento se mantiene en 0", () => {
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(1, -1, 3)).toBe(0);
  });

  it("ArrowDown en el último elemento se mantiene en el último", () => {
    expect(stepIndex(2, +1, 3)).toBe(2);
    expect(stepIndex(3, +1, 4)).toBe(3);
  });

  it("desplaza el índice en el rango medio", () => {
    expect(stepIndex(1, +1, 4)).toBe(2);
    expect(stepIndex(2, -1, 4)).toBe(1);
    expect(stepIndex(5, -2, 10)).toBe(3);
  });
});

describe("palette/model → itemKey y itemLabel (etiquetas visibles)", () => {
  it("itemKey distingue por tipo e id", () => {
    expect(
      itemKey({ kind: "command", command: makeCommand({ id: "c1" }) }),
    ).toBe("cmd:c1");
    expect(itemKey({ kind: "task", task: makeTask({ id: "t1" }) })).toBe(
      "task:t1",
    );
    expect(itemKey({ kind: "note", note: makeNote({ id: "n1" }) })).toBe(
      "note:n1",
    );
    expect(itemKey({ kind: "recent", entry: recentRoute })).toBe(
      "recent:route:/tasks",
    );
    expect(itemKey({ kind: "recent", entry: recentTask })).toBe(
      "recent:task:t-recent",
    );
  });

  it("itemLabel muestra el título de cada tipo", () => {
    expect(itemLabel({ kind: "command", command: makeCommand() })).toBe(
      "Comando de prueba",
    );
    expect(itemLabel({ kind: "task", task: makeTask() })).toBe(
      "Tarea de ejemplo",
    );
    expect(itemLabel({ kind: "note", note: makeNote() })).toBe(
      "Nota de ejemplo",
    );
    expect(itemLabel({ kind: "recent", entry: recentRoute })).toBe("Tareas");
    expect(itemLabel({ kind: "recent", entry: recentTask })).toBe(
      "Tarea reciente",
    );
  });

  it("itemLabel usa 'Nota sin título' cuando la nota no tiene título", () => {
    expect(itemLabel({ kind: "note", note: makeNote({ title: null }) })).toBe(
      "Nota sin título",
    );
  });
});

describe("palette/model → buildSections respeta available() bajo consulta", () => {
  it("evalúa available() también con consulta activa", () => {
    const hidden = makeCommand({ available: () => false });
    const sections = buildSections([hidden], "nueva", emptyRemote);
    expect(sections).toEqual([]);
  });

  it("aplica available() por comando (no comparte estado)", () => {
    const available = vi.fn().mockReturnValue(true);
    const first = makeCommand({ id: "c1", available: () => available() });
    const second = makeCommand({ id: "c2", available: () => available() });

    const sections = buildSections([first, second], "", emptyRemote);

    expect(commandIds(sections.flatMap((s) => s.items))).toEqual(["c1", "c2"]);
    expect(available).toHaveBeenCalledTimes(2);
  });
});
