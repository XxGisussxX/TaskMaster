import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestTimeoutException } from "@nestjs/common";
import { DocumentsService } from "./documents.service";

const { renderToBufferMock } = vi.hoisted(() => ({
  renderToBufferMock: vi.fn(),
}));

vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: renderToBufferMock,
}));

describe("DocumentsService.generatePdf con timeout", () => {
  beforeEach(() => {
    renderToBufferMock.mockReset();
  });

  it("rechaza con 408 si el render no termina antes del limite", async () => {
    renderToBufferMock.mockImplementation(
      () => new Promise<Uint8Array>(() => {}),
    );
    const service = new DocumentsService();

    await expect(
      service.generatePdf({ content: "contenido", template: "minimal" }),
    ).rejects.toBeInstanceOf(RequestTimeoutException);
  }, 25_000);

  it("devuelve el buffer si el render termina a tiempo y limpia el timer", async () => {
    renderToBufferMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const service = new DocumentsService();

    const pdf = await service.generatePdf({
      content: "contenido",
      template: "minimal",
    });

    expect(pdf).toEqual(Buffer.from([1, 2, 3]));
  });
});
