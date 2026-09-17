import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { UploadsService } from "./uploads.service";

const WORKSPACE_ID = "ws1";
const USER_ID = "user1";

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    originalname: "file.txt",
    mimetype: "text/plain",
    size: 1024,
    buffer: Buffer.from("hello"),
    ...overrides,
  } as Express.Multer.File;
}

function setup(options: {
  taskInWorkspace?: boolean;
  noteInWorkspace?: boolean;
}) {
  const prisma = {
    task: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          options.taskInWorkspace === false ? null : { id: "task1" },
        ),
    },
    note: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          options.noteInWorkspace === false ? null : { id: "note1" },
        ),
    },
    attachment: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "att1",
          publicId: null,
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          ...data,
        }),
      ),
    },
  };
  const access = { assertWriteRole: vi.fn().mockResolvedValue({ id: "m1" }) };
  const service = new UploadsService(prisma as never, access as never);
  return { service, prisma, access };
}

describe("UploadsService.upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza un archivo que excede el tamaño máximo", async () => {
    const { service, prisma } = setup({});
    const file = makeFile({ size: 11 * 1024 * 1024 });

    await expect(
      service.upload(WORKSPACE_ID, USER_ID, file, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("rechaza un MIME type no permitido", async () => {
    const { service, prisma } = setup({});
    const file = makeFile({ mimetype: "application/x-msdownload" });

    await expect(
      service.upload(WORKSPACE_ID, USER_ID, file, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("rechaza una tarea que no pertenece al workspace", async () => {
    const { service, prisma } = setup({ taskInWorkspace: false });

    await expect(
      service.upload(WORKSPACE_ID, USER_ID, makeFile(), { taskId: "foreign" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("rechaza una nota que no pertenece al workspace", async () => {
    const { service, prisma } = setup({ noteInWorkspace: false });

    await expect(
      service.upload(WORKSPACE_ID, USER_ID, makeFile(), { noteId: "foreign" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("crea el adjunto cuando la tarea pertenece al workspace", async () => {
    const { service, prisma } = setup({});

    const attachment = await service.upload(WORKSPACE_ID, USER_ID, makeFile(), {
      taskId: "task1",
    });

    expect(attachment.taskId).toBe("task1");
    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { id: "task1", workspaceId: WORKSPACE_ID },
      select: { id: true },
    });
  });
});
