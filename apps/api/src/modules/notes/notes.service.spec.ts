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
      delete: vi.fn().mockResolvedValue(undefined),
    },
    noteTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    checklistItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    noteCollaborator: { deleteMany: vi.fn(), createMany: vi.fn() },
    // `update` envuelve todo en un `$transaction` con callback que recibe un tx.
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
  };
  const access = {
    assertWriteRole: vi.fn().mockResolvedValue(undefined),
    assertMembership: vi.fn().mockResolvedValue(undefined),
  };
  const activity = { log: vi.fn().mockResolvedValue(undefined) };
  const service = new NotesService(
    prisma as never,
    access as never,
    activity as never,
  );
  return { service, prisma };
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
