import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WorkspaceRole } from "@taskmaster/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DreamBoardService } from "./dream-board.service";

const PIN = {
  id: "pin1",
  workspaceId: "ws1",
  boardId: "board1",
  title: "Correr 10k",
  description: "",
  type: "GOAL",
  color: "AMBER",
  x: 10,
  y: 20,
  imageUrl: null as string | null,
  createdById: "u1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const BOARD = {
  id: "board1",
  workspaceId: "ws1",
  title: "Mi Tablero de Sueños",
  createdAt: PIN.createdAt,
  updatedAt: PIN.updatedAt,
};

function setup(options?: {
  pin?: typeof PIN | null;
  role?: WorkspaceRole;
  memberUserId?: string;
  boardExists?: boolean;
  taskInWorkspace?: boolean;
}) {
  const pin = options?.pin === undefined ? PIN : options.pin;
  const member = {
    id: "m1",
    workspaceId: "ws1",
    userId: options?.memberUserId ?? "u1",
    role: options?.role ?? WorkspaceRole.MEMBER,
    createdAt: new Date(0),
  };

  const prisma = {
    dreamBoard: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options?.boardExists === false ? null : { ...BOARD, pins: [PIN] },
        ),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...BOARD, pins: [] }),
      create: vi.fn().mockResolvedValue({ ...BOARD, pins: [] }),
      update: vi.fn().mockResolvedValue(BOARD),
    },
    dreamPin: {
      create: vi.fn().mockResolvedValue(PIN),
      findFirst: vi.fn().mockResolvedValue(pin),
      update: vi.fn().mockResolvedValue({ ...PIN, title: "Nuevo" }),
      delete: vi.fn().mockResolvedValue(PIN),
    },
    task: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options?.taskInWorkspace === false ? null : {}),
    },
  };

  const access = {
    assertMembership: vi.fn().mockResolvedValue(member),
    assertWriteRole: vi.fn().mockResolvedValue(member),
  };

  const uploads = {
    destroyImageByUrl: vi.fn().mockResolvedValue(undefined),
  };

  const service = new DreamBoardService(
    prisma as never,
    access as never,
    uploads as never,
  );
  return { service, prisma, access, uploads, member };
}

describe("DreamBoardService.getBoard", () => {
  it("devuelve el tablero con sus pins anidados", async () => {
    const { service, access } = setup();

    const board = await service.getBoard("ws1", "u1");

    expect(access.assertMembership).toHaveBeenCalledWith("ws1", "u1");
    expect(board.id).toBe("board1");
    expect(board.pins).toHaveLength(1);
    expect(board.pins[0]).toMatchObject({ id: "pin1", title: "Correr 10k" });
  });

  it("serializa las fechas a ISO", async () => {
    const { service } = setup();

    const board = await service.getBoard("ws1", "u1");

    expect(board.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(board.pins[0]?.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("crea el tablero la primera vez que se consulta", async () => {
    const { service, prisma } = setup({ boardExists: false });

    const board = await service.getBoard("ws1", "u1");

    expect(prisma.dreamBoard.create).toHaveBeenCalledWith({
      data: { workspaceId: "ws1" },
    });
    expect(prisma.dreamBoard.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { workspaceId: "ws1" },
      include: expect.objectContaining({ pins: expect.any(Object) }),
    });
    expect(board.pins).toEqual([]);
  });

  it("tolera la carrera de creación: P2002 relee el tablero del ganador", async () => {
    const { service, prisma } = setup({ boardExists: false });
    prisma.dreamBoard.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["workspaceId"] },
      }),
    );

    const board = await service.getBoard("ws1", "u1");

    expect(prisma.dreamBoard.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { workspaceId: "ws1" },
      include: expect.objectContaining({ pins: expect.any(Object) }),
    });
    expect(board.id).toBe("board1");
  });

  it("propaga errores que no son P2002 al crear el tablero", async () => {
    const { service, prisma } = setup({ boardExists: false });
    prisma.dreamBoard.create.mockRejectedValueOnce(new Error("boom"));

    await expect(service.getBoard("ws1", "u1")).rejects.toThrow("boom");
    expect(prisma.dreamBoard.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("DreamBoardService.updateBoard", () => {
  it("renombra el tablero y devuelve el DTO", async () => {
    const { service, prisma } = setup();
    prisma.dreamBoard.update.mockResolvedValueOnce({
      ...BOARD,
      title: "Nuevo",
      pins: [],
    });

    const board = await service.updateBoard("ws1", "u1", { title: "Nuevo" });

    expect(prisma.dreamBoard.update).toHaveBeenCalledWith({
      where: { workspaceId: "ws1" },
      data: { title: "Nuevo" },
      include: expect.any(Object),
    });
    expect(board.title).toBe("Nuevo");
  });
});

describe("DreamBoardService.createPin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea el pin en el tablero del workspace", async () => {
    const { service, prisma } = setup();

    const pin = await service.createPin("ws1", "u1", {
      title: "Correr 10k",
      description: "",
      type: "GOAL",
      color: "AMBER",
      positionX: 30,
      positionY: 40,
    });

    expect(prisma.dreamPin.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws1",
        boardId: "board1",
        title: "Correr 10k",
        description: "",
        type: "GOAL",
        color: "AMBER",
        x: 30,
        y: 40,
        imageUrl: undefined,
        sticker: undefined,
        linkedTaskId: undefined,
        createdById: "u1",
      },
      include: expect.objectContaining({
        linkedTask: expect.any(Object),
      }),
    });
    expect(pin.id).toBe("pin1");
  });

  it("crea el tablero implícitamente si el workspace todavía no tiene", async () => {
    const { service, prisma } = setup({ boardExists: false });

    await service.createPin("ws1", "u1", {
      title: "Meta",
      description: "",
      type: "GOAL",
      color: "AMBER",
      positionX: 0,
      positionY: 0,
    });

    expect(prisma.dreamBoard.create).toHaveBeenCalledWith({
      data: { workspaceId: "ws1" },
    });
    expect(prisma.dreamPin.create).toHaveBeenCalled();
  });

  it("no escribe si el usuario no es miembro con permisos de escritura", async () => {
    const { service, prisma, access } = setup();
    access.assertWriteRole.mockRejectedValue(new ForbiddenException());

    await expect(
      service.createPin("ws1", "u1", {
        title: "Meta",
        description: "",
        type: "GOAL",
        color: "AMBER",
        positionX: 0,
        positionY: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.dreamPin.create).not.toHaveBeenCalled();
  });

  it("enlaza a una tarea del mismo workspace", async () => {
    const { service, prisma } = setup();

    const pin = await service.createPin("ws1", "u1", {
      title: "Correr 10k",
      description: "",
      type: "GOAL",
      color: "AMBER",
      positionX: 0,
      positionY: 0,
      linkedTaskId: "task1",
    });

    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { id: "task1", workspaceId: "ws1" },
      select: { id: true },
    });
    expect(prisma.dreamPin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkedTaskId: "task1" }),
      }),
    );
    expect(pin.id).toBe("pin1");
  });

  it("rechaza enlazar a una tarea de otro workspace (IDOR)", async () => {
    const { service, prisma } = setup({ taskInWorkspace: false });

    await expect(
      service.createPin("ws1", "u1", {
        title: "Correr 10k",
        description: "",
        type: "GOAL",
        color: "AMBER",
        positionX: 0,
        positionY: 0,
        linkedTaskId: "task-ajena",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.dreamPin.create).not.toHaveBeenCalled();
  });
});

describe("DreamBoardService.updatePin", () => {
  it("sólo toca los campos enviados: mover un pin no anula imagen, sticker ni tarea", async () => {
    const { service, prisma } = setup();

    const pin = await service.updatePin("ws1", "pin1", "u1", {
      positionX: 5,
      positionY: 6,
    });

    // El `data` NO debe incluir las claves ausentes: si se incluyera
    // `imageUrl`/`sticker`/`linkedTaskId` como `null`, un drag las borraría.
    expect(prisma.dreamPin.update).toHaveBeenCalledWith({
      where: { id: "pin1" },
      data: { x: 5, y: 6 },
      include: expect.objectContaining({
        linkedTask: expect.any(Object),
      }),
    });
    expect(pin.title).toBe("Nuevo");
  });

  it("distingue `undefined` (no tocar) de `null` (borrar a propósito)", async () => {
    const { service, prisma } = setup();

    await service.updatePin("ws1", "pin1", "u1", {
      title: "Nuevo",
      imageUrl: null,
      sticker: null,
      linkedTaskId: null,
    });

    expect(prisma.dreamPin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: "Nuevo",
          imageUrl: null,
          sticker: null,
          linkedTaskId: null,
        },
      }),
    );
  });

  it("normaliza la cadena vacía a `null` (borrar con el input de la UI)", async () => {
    const { service, prisma } = setup();

    await service.updatePin("ws1", "pin1", "u1", {
      imageUrl: "",
      sticker: "",
    });

    expect(prisma.dreamPin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { imageUrl: null, sticker: null },
      }),
    );
  });

  it("actualiza el `updatedAt` del tablero al modificar un pin", async () => {
    const { service, prisma } = setup();

    await service.updatePin("ws1", "pin1", "u1", {
      positionX: 1,
      positionY: 1,
    });

    expect(prisma.dreamBoard.update).toHaveBeenCalledWith({
      where: { workspaceId: "ws1" },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it("busca el pin acotado al workspace", async () => {
    const { service, prisma } = setup();

    await service.updatePin("ws1", "pin1", "u1", { title: "Nuevo" });

    expect(prisma.dreamPin.findFirst).toHaveBeenCalledWith({
      where: { id: "pin1", workspaceId: "ws1" },
    });
  });

  it("no encuentra un pin de otro workspace", async () => {
    const { service, prisma } = setup({ pin: null });

    await expect(
      service.updatePin("ws1", "ajeno", "u1", { title: "Nuevo" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.dreamPin.update).not.toHaveBeenCalled();
  });

  it("impide que un miembro edite el pin de otro", async () => {
    const { service, prisma } = setup({
      pin: { ...PIN, createdById: "u2" },
      memberUserId: "u1",
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      service.updatePin("ws1", "pin1", "u1", { title: "Nuevo" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.dreamPin.update).not.toHaveBeenCalled();
  });

  it("permite que un admin edite el pin de otro", async () => {
    const { service } = setup({
      pin: { ...PIN, createdById: "u2" },
      memberUserId: "u1",
      role: WorkspaceRole.ADMIN,
    });

    await expect(
      service.updatePin("ws1", "pin1", "u1", { title: "Nuevo" }),
    ).resolves.toMatchObject({ id: "pin1" });
  });

  it("permite que el owner edite el pin de otro", async () => {
    const { service } = setup({
      pin: { ...PIN, createdById: "u2" },
      memberUserId: "u1",
      role: WorkspaceRole.OWNER,
    });

    await expect(
      service.updatePin("ws1", "pin1", "u1", { title: "Nuevo" }),
    ).resolves.toMatchObject({ id: "pin1" });
  });

  it("rechaza re-enlazar a una tarea de otro workspace (IDOR)", async () => {
    const { service, prisma } = setup({ taskInWorkspace: false });

    await expect(
      service.updatePin("ws1", "pin1", "u1", {
        linkedTaskId: "task-ajena",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.dreamPin.update).not.toHaveBeenCalled();
  });

  it("destruye el asset anterior al reemplazar la imagen", async () => {
    const { service, prisma, uploads } = setup({
      pin: {
        ...PIN,
        imageUrl: "https://res.cloudinary.com/c/image/upload/v1/a.jpg",
      },
    });
    prisma.dreamPin.update.mockResolvedValueOnce({
      ...PIN,
      imageUrl: "https://res.cloudinary.com/c/image/upload/v1/b.jpg",
    });

    await service.updatePin("ws1", "pin1", "u1", {
      imageUrl: "https://res.cloudinary.com/c/image/upload/v1/b.jpg",
    });

    expect(uploads.destroyImageByUrl).toHaveBeenCalledWith(
      "https://res.cloudinary.com/c/image/upload/v1/a.jpg",
    );
  });

  it("no destruye el asset si la imagen no cambia", async () => {
    const url = "https://res.cloudinary.com/c/image/upload/v1/a.jpg";
    const { service, prisma, uploads } = setup({
      pin: { ...PIN, imageUrl: url },
    });
    prisma.dreamPin.update.mockResolvedValueOnce({ ...PIN, imageUrl: url });

    await service.updatePin("ws1", "pin1", "u1", { imageUrl: url });

    expect(uploads.destroyImageByUrl).not.toHaveBeenCalled();
  });
});

describe("DreamBoardService.removePin", () => {
  it("borra el pin y devuelve su id", async () => {
    const { service, prisma } = setup();

    await expect(service.removePin("ws1", "pin1", "u1")).resolves.toEqual({
      id: "pin1",
    });
    expect(prisma.dreamPin.delete).toHaveBeenCalledWith({
      where: { id: "pin1" },
    });
  });

  it("destruye el asset del pin al borrarlo", async () => {
    const url = "https://res.cloudinary.com/c/image/upload/v1/a.jpg";
    const { service, uploads } = setup({ pin: { ...PIN, imageUrl: url } });

    await service.removePin("ws1", "pin1", "u1");

    expect(uploads.destroyImageByUrl).toHaveBeenCalledWith(url);
  });

  it("no borra el pin de otro miembro", async () => {
    const { service, prisma } = setup({
      pin: { ...PIN, createdById: "u2" },
      memberUserId: "u1",
      role: WorkspaceRole.MEMBER,
    });

    await expect(service.removePin("ws1", "pin1", "u1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.dreamPin.delete).not.toHaveBeenCalled();
  });

  it("propaga 404 para un pin inexistente", async () => {
    const { service, prisma } = setup({ pin: null });

    await expect(service.removePin("ws1", "nope", "u1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.dreamPin.delete).not.toHaveBeenCalled();
  });
});
