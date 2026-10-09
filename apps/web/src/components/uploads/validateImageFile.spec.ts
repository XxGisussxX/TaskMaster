import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  isSupportedImageType,
  validateImageFile,
} from "./validateImageFile";

function makeFile(type: string, size: number): File {
  return { type, size } as File;
}

describe("validateImageFile", () => {
  it("acepta los tipos de imagen soportados", () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(validateImageFile(makeFile(type, 1024))).toBeNull();
    }
  });

  it("rechaza un tipo no soportado", () => {
    const result = validateImageFile(makeFile("application/pdf", 1024));
    expect(result).toMatch(/Formato no permitido/);
  });

  it("rechaza una imagen que supera los 5 MB", () => {
    const result = validateImageFile(
      makeFile("image/png", MAX_IMAGE_SIZE_BYTES + 1),
    );
    expect(result).toMatch(/5 MB/);
  });
});

describe("isSupportedImageType", () => {
  it("reconoce jpg, png, webp y gif", () => {
    expect(isSupportedImageType("image/jpeg")).toBe(true);
    expect(isSupportedImageType("image/png")).toBe(true);
    expect(isSupportedImageType("image/webp")).toBe(true);
    expect(isSupportedImageType("image/gif")).toBe(true);
  });

  it("descarta otros formatos", () => {
    expect(isSupportedImageType("image/svg+xml")).toBe(false);
    expect(isSupportedImageType("")).toBe(false);
  });
});
