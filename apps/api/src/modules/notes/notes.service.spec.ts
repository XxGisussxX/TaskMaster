import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { NoteType } from "@taskmaster/contracts";
import { NotesService } from "./notes.service";

const WORKSPACE_ID = "ws1";
const USER_ID = "u1";

/**
 * El sanitizado de HTML vive en `common/sanitize/html` y tiene sus propios
 * tests. Lo que se verifica acá es el *cableado*: que el contenido pasa por él
 * en el camino de escritura. Un servicio nuevo, o un `prisma.note.update` que
 * se escriba en otro lado, es la forma más fácil de reintroducir el problema.
 */
function setup() {
  const prisma = {
    note: {
      create: vi.fn().mockResolvedValue(makeNote()),
      update: vi.fn().mockResolvedValue(makeNote()),
      findFirst: vi.fn().mockResolvedValue({ id: "n1" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "n1" }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    noteTag: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    checklistItem: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    noteCollaborator: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    workspaceMember: {
      count: vi.fn((args: { where?: { userId?: { in?: string[] } } }) =>
        Promise.resolve(args?.where?.userId?.in?.length ?? 0),
      ),
    },
    // `update` envuelve todo en un `$transaction` con callback que recibe un tx.
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
  };
  const access = {
    assertWriteRole: vi.fn().mockResolvedValue(undefined),
    assertMembership: vi.fn().mockResolvedValue(undefined),
  };
  const activity = { log: vi.fn().mockResolvedValue(undefined) };
  const events = { emit: vi.fn() };
  const service = new NotesService(
    prisma as never,
    access as never,
    activity as never,
    events as never,
  );
  return { service, prisma, events };
}

function makeNote() {
  return {
    id: "n1",
    workspaceId: WORKSPACE_ID,
    authorId: USER_ID,
    type: NoteType.STANDARD,
    title: "nota",
    content: "<p>hola</p>",
    color: null,
    pinned: false,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    tags: [],
    items: [],
    collaborators: [],
  };
}

describe("NotesService — sanitizado de HTML en la escritura", () => {
  it("sanea el content al crear", async () => {
    const { service, prisma } = setup();

    await service.create(WORKSPACE_ID, USER_ID, {
      type: NoteType.STANDARD,
      title: "nota",
      content: "<p>hola</p><script>alert('xss')</script>",
      tags: [],
      items: [],
      collaborators: [],
      pinned: false,
    } as never);

    const data = prisma.note.create.mock.calls[0]![0].data;
    expect(data.content).toBe("<p>hola</p>");
    expect(data.content).not.toContain("script");
  });

  it("sanea el content al actualizar", async () => {
    const { service, prisma } = setup();

    await service.update(WORKSPACE_ID, "n1", USER_ID, {
      content: '<img src="x" onerror="steal()"><p>texto</p>',
    } as never);

    const data = prisma.note.update.mock.calls[0]![0].data;
    expect(data.content).toBe("<p>texto</p>");
    expect(data.content).not.toContain("onerror");
  });

  it("mata javascript: en el content", async () => {
    const { service, prisma } = setup();

    await service.create(WORKSPACE_ID, USER_ID, {
      type: NoteType.STANDARD,
      title: "nota",
      content: '<a href="javascript:alert(1)">click</a>',
      tags: [],
      items: [],
      collaborators: [],
      pinned: false,
    } as never);

    const data = prisma.note.create.mock.calls[0]![0].data;
    expect(data.content).not.toContain("javascript");
    expect(data.content).toContain("click");
  });

  it("deja content sin tocar cuando el update no lo manda", async () => {
    const { service, prisma } = setup();

    await service.update(WORKSPACE_ID, "n1", USER_ID, {
      title: "solo el titulo",
    } as never);

    const data = prisma.note.update.mock.calls[0]![0].data;
    // Si esto fuera null, un PATCH de solo título vaciaría la nota.
    expect(data.content).toBeUndefined();
  });

  it("conserva el HTML legitimo del editor", async () => {
    const { service, prisma } = setup();
    const html =
      "<p>hola <strong>mundo</strong></p><ul><li>uno</li><li>dos</li></ul>";

    await service.create(WORKSPACE_ID, USER_ID, {
      type: NoteType.STANDARD,
      title: "nota",
      content: html,
      tags: [],
      items: [],
      collaborators: [],
      pinned: false,
    } as never);

    const data = prisma.note.create.mock.calls[0]![0].data;
    expect(data.content).toBe(html);
  });
});

describe("NotesService — filtro por tag (N1)", () => {
  it("filtra por nombre de tag, no por id", async () => {
    const { service, prisma } = setup();

    await service.list(WORKSPACE_ID, USER_ID, {
      page: 1,
      pageSize: 24,
      tag: "Urgente",
    });

    const where = prisma.note.findMany.mock.calls[0]![0].where;
    expect(where.tags).toEqual({
      some: { name: { equals: "Urgente", mode: "insensitive" } },
    });
  });

  it("no filtra cuando no se manda tag", async () => {
    const { service, prisma } = setup();

    await service.list(WORKSPACE_ID, USER_ID, { page: 1, pageSize: 24 });

    const where = prisma.note.findMany.mock.calls[0]![0].where;
    expect(where.tags).toBeUndefined();
  });
});

describe("NotesService — update sin delete+recreate (N6)", () => {
  it("actualiza items existentes en lugar de recrearlos", async () => {
    const { service, prisma } = setup();
    prisma.checklistItem.findMany.mockResolvedValue([{ id: "i1" }]);

    await service.update(WORKSPACE_ID, "n1", USER_ID, {
      items: [{ id: "i1", text: "editado", done: true, order: 0 }],
    } as never);

    expect(prisma.checklistItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.checklistItem.create).not.toHaveBeenCalled();
    expect(prisma.checklistItem.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { text: "editado", done: true, order: 0 },
    });
  });

  it("borra solo los items ausentes y agrega los nuevos", async () => {
    const { service, prisma } = setup();
    prisma.checklistItem.findMany.mockResolvedValue([
      { id: "i1" },
      { id: "i2" },
    ]);

    await service.update(WORKSPACE_ID, "n1", USER_ID, {
      items: [
        { id: "i1", text: "queda", done: false, order: 0 },
        { text: "nuevo", done: false, order: 1 },
      ],
    } as never);

    expect(prisma.checklistItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["i2"] } },
    });
    expect(prisma.checklistItem.update).toHaveBeenCalledTimes(1);
    expect(prisma.checklistItem.create).toHaveBeenCalledWith({
      data: { noteId: "n1", text: "nuevo", done: false, order: 1 },
    });
  });

  it("no toca tags ni colaboradores ausentes del payload", async () => {
    const { service, prisma } = setup();

    await service.update(WORKSPACE_ID, "n1", USER_ID, {
      title: "solo titulo",
    } as never);

    expect(prisma.noteTag.findMany).not.toHaveBeenCalled();
    expect(prisma.checklistItem.findMany).not.toHaveBeenCalled();
    expect(prisma.noteCollaborator.findMany).not.toHaveBeenCalled();
  });

  it("hace diff de tags por nombre", async () => {
    const { service, prisma } = setup();
    prisma.noteTag.findMany.mockResolvedValue([{ name: "a" }, { name: "b" }]);

    await service.update(WORKSPACE_ID, "n1", USER_ID, {
      tags: ["b", "c"],
    } as never);

    expect(prisma.noteTag.deleteMany).toHaveBeenCalledWith({
      where: { noteId: "n1", name: { in: ["a"] } },
    });
    expect(prisma.noteTag.createMany).toHaveBeenCalledWith({
      data: [{ noteId: "n1", name: "c" }],
      skipDuplicates: true,
    });
  });

  it("hace diff de colaboradores por userId", async () => {
    const { service, prisma } = setup();
    prisma.noteCollaborator.findMany.mockResolvedValue([{ userId: "u2" }]);

    await service.update(WORKSPACE_ID, "n1", USER_ID, {
      collaborators: ["u2", "u3"],
    } as never);

    expect(prisma.noteCollaborator.deleteMany).not.toHaveBeenCalled();
    expect(prisma.noteCollaborator.createMany).toHaveBeenCalledWith({
      data: [{ noteId: "n1", userId: "u3" }],
      skipDuplicates: true,
    });
  });
});

describe("NotesService — eventos en tiempo real", () => {
  it("emite note.created al crear", async () => {
    const { service, events } = setup();

    await service.create(WORKSPACE_ID, USER_ID, {
      type: NoteType.STANDARD,
      title: "nota",
      content: "<p>hola</p>",
      tags: [],
      items: [],
      collaborators: [],
      pinned: false,
    } as never);

    expect(events.emit).toHaveBeenCalledWith(
      "note.created",
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        note: expect.objectContaining({ id: "n1" }),
      }),
    );
  });

  it("emite note.updated al actualizar y al fijar", async () => {
    const { service, events } = setup();

    await service.update(WORKSPACE_ID, "n1", USER_ID, {
      title: "otra",
    } as never);
    await service.togglePin(WORKSPACE_ID, "n1", USER_ID, true);

    expect(events.emit).toHaveBeenCalledTimes(2);
    expect(events.emit).toHaveBeenNthCalledWith(1, "note.updated", {
      workspaceId: WORKSPACE_ID,
      note: expect.objectContaining({ id: "n1" }),
    });
    expect(events.emit).toHaveBeenNthCalledWith(2, "note.updated", {
      workspaceId: WORKSPACE_ID,
      note: expect.objectContaining({ id: "n1" }),
    });
  });

  it("emite note.deleted al eliminar", async () => {
    const { service, events } = setup();

    await service.remove(WORKSPACE_ID, "n1", USER_ID);

    expect(events.emit).toHaveBeenCalledWith("note.deleted", {
      workspaceId: WORKSPACE_ID,
      noteId: "n1",
    });
  });
});
