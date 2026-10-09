import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ImageUploadsController } from "./image-uploads.controller";
import type { UploadsService } from "./uploads.service";

describe("ImageUploadsController.uploadImage", () => {
  it("delega en el servicio y devuelve la URL pública", async () => {
    const service = {
      uploadImage: vi
        .fn()
        .mockResolvedValue({ url: "https://res.cloudinary.com/x/image.jpg" }),
    } as unknown as UploadsService;
    const controller = new ImageUploadsController(service);
    const file = {
      originalname: "foto.jpg",
      mimetype: "image/jpeg",
    } as Express.Multer.File;

    const result = await controller.uploadImage(file);

    expect(service.uploadImage).toHaveBeenCalledWith(file);
    expect(result).toEqual({
      url: "https://res.cloudinary.com/x/image.jpg",
    });
  });
});
