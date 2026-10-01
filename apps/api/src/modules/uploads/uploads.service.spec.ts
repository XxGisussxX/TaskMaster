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

  it("rechaza un archivo vacío", () => {
    const { service } = setup({});
    expect(() =>
      service.validateFile(makeFile({ buffer: Buffer.alloc(0), size: 0 })),
    ).toThrow(BadRequestException);
  });

  it("crea el adjunto cuando la tarea pertenece al workspace", async () => {
    const { service, prisma } = setup({});

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03, 0x04,
    ]);
    const file = makeFile({
      originalname: "img.png",
      mimetype: "image/png",
      buffer: png,
    });

    const attachment = await service.upload(WORKSPACE_ID, USER_ID, file, {
      taskId: "task1",
    });

    expect(attachment.taskId).toBe("task1");
    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { id: "task1", workspaceId: WORKSPACE_ID },
      select: { id: true },
    });
  });
});

describe("UploadsService.validateFile · contenido real", () => {
  const { service } = setup({});

  it("acepta un PNG con firma válida", () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "image/png", buffer, size: buffer.length }),
      ),
    ).not.toThrow();
  });

  it("acepta un JPEG con firma válida", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "image/jpeg", buffer, size: buffer.length }),
      ),
    ).not.toThrow();
  });

  it("acepta un PDF con firma válida", () => {
    const buffer = Buffer.from("%PDF-1.7\n...", "utf8");
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "application/pdf", buffer, size: buffer.length }),
      ),
    ).not.toThrow();
  });

  it("acepta un WebP con RIFF+WEBP en los bytes correctos", () => {
    const buffer = Buffer.alloc(16);
    buffer.write("RIFF", 0, "ascii");
    buffer.writeUInt32LE(8, 4);
    buffer.write("WEBP", 8, "ascii");
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "image/webp", buffer, size: buffer.length }),
      ),
    ).not.toThrow();
  });

  it("rechaza WebP sin la marca WEBP (firma RIFF de otro formato)", () => {
    const buffer = Buffer.alloc(16);
    buffer.write("RIFF", 0, "ascii");
    buffer.write("AVI ", 8, "ascii");
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "image/webp", buffer, size: buffer.length }),
      ),
    ).toThrow(BadRequestException);
  });

  // Este es el ataque real: declarar image/png y mandar cualquier otra cosa.
  it("rechaza HTML disfrazado como image/png", () => {
    const buffer = Buffer.from(
      "<html><script>alert(document.cookie)</script></html>",
      "utf8",
    );
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "image/png", buffer, size: buffer.length }),
      ),
    ).toThrow(BadRequestException);
  });

  it("rechaza un script sin cabecera PDF válida", () => {
    const buffer = Buffer.from(
      '<html><script>alert(document.cookie)</script></html>',
      "utf8",
    );
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "application/pdf", buffer, size: buffer.length }),
      ),
    ).toThrow(BadRequestException);
  });

  // Límite conocido y deliberado de la validación por magic bytes: se verifica
  // el TIPO del contenedor, no que el contenido sea inerte. Un PDF con /JS
  // (JavaScript embebido) tiene cabecera %PDF válida y pasa.
  //
  // Se cierra en la Fase 3 sirviendo los adjuntos desde otro origen (Cloudinary)
  // y forzando Content-Disposition: attachment, no con más heuristics aquí.
  it("acepta un PDF con cabecera válida aunque contenga /JS (límite conocido)", () => {
    const buffer = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.from("<< /JS (app.alert(1)) >>"),
    ]);
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "application/pdf", buffer, size: buffer.length }),
      ),
    ).not.toThrow();
  });

  it("rechaza binario arbitrario declarado como text/plain", () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00, 0xff]);
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "text/plain", buffer, size: buffer.length }),
      ),
    ).toThrow(BadRequestException);
  });

  it("rechaza un ejecutable declarado como application/zip", () => {
    const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "application/zip", buffer, size: buffer.length }),
      ),
    ).toThrow(BadRequestException);
  });

  it("rechaza un docx que no es contenedor ZIP", () => {
    const buffer = Buffer.from("no soy un zip", "utf8");
    expect(() =>
      service.validateFile(
        makeFile({
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer,
          size: buffer.length,
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it("rechaza SVG (contenido activo con capacidad de XSS)", () => {
    const buffer = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      "utf8",
    );
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "image/svg+xml", buffer, size: buffer.length }),
      ),
    ).toThrow(BadRequestException);
  });

  it("acepta CSV como texto", () => {
    const buffer = Buffer.from("a,b,c\n1,2,3\n", "utf8");
    expect(() =>
      service.validateFile(
        makeFile({ mimetype: "text/csv", buffer, size: buffer.length }),
      ),
    ).not.toThrow();
  });

  it("acepta JSON como texto", () => {
    const buffer = Buffer.from('{"a":1}', "utf8");
    expect(() =>
      service.validateFile(
        makeFile({
          mimetype: "application/json",
          buffer,
          size: buffer.length,
        }),
      ),
    ).not.toThrow();
  });

  it("rechaza un tipo fuera de la allowlist antes de mirar los bytes", () => {
    const buffer = Buffer.from("#!/bin/sh\nrm -rf /", "utf8");
    expect(() =>
      service.validateFile(
        makeFile({
          mimetype: "application/x-sh",
          buffer,
          size: buffer.length,
        }),
      ),
    ).toThrow(/no permitido/);
  });
});
