import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageUploader } from "./ImageUploader";

function makePngFile(name = "foto.png"): File {
  return new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    name,
    { type: "image/png" },
  );
}

function makeClipboardData(file: File) {
  return {
    items: [{ kind: "file", type: file.type, getAsFile: () => file }],
    files: [file],
  };
}

const uploadedUrl = "https://cdn.fake/taskmaster/images/x.png";
const uploaded = { url: uploadedUrl, publicId: "taskmaster/images/x" };

describe("ImageUploader", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("muestra la preview cuando hay una URL", () => {
    render(
      <ImageUploader
        value={uploadedUrl}
        onChange={vi.fn()}
        uploadImage={vi.fn()}
      />,
    );
    expect(screen.getByTestId("image-preview").getAttribute("src")).toBe(
      uploadedUrl,
    );
  });

  it("rechaza un tipo que no es imagen y no sube nada", async () => {
    const upload = vi.fn();
    render(<ImageUploader onChange={vi.fn()} uploadImage={upload} />);

    fireEvent.change(screen.getByTestId("image-upload-input"), {
      target: {
        files: [new File(["hola"], "nota.txt", { type: "text/plain" })],
      },
    });

    expect(
      (await screen.findByTestId("image-upload-error")).textContent,
    ).toContain("Formato no permitido");
    expect(upload).not.toHaveBeenCalled();
  });

  it("rechaza una imagen que supera los 5 MB", async () => {
    const upload = vi.fn();
    render(<ImageUploader onChange={vi.fn()} uploadImage={upload} />);

    fireEvent.change(screen.getByTestId("image-upload-input"), {
      target: { files: [{ type: "image/png", size: 6 * 1024 * 1024 } as File] },
    });

    expect(
      (await screen.findByTestId("image-upload-error")).textContent,
    ).toContain("5 MB");
    expect(upload).not.toHaveBeenCalled();
  });

  it("sube un archivo válido y reporta la URL por onChange", async () => {
    const upload = vi.fn(
      async (_file: File, _onProgress: (percent: number) => void) => uploaded,
    );
    const onChange = vi.fn();
    const onUploaded = vi.fn();
    render(
      <ImageUploader
        onChange={onChange}
        onUploaded={onUploaded}
        uploadImage={upload}
      />,
    );

    fireEvent.change(screen.getByTestId("image-upload-input"), {
      target: { files: [makePngFile()] },
    });

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith(uploadedUrl);
    expect(onUploaded).toHaveBeenCalledWith(uploaded);
    const firstCall = upload.mock.calls[0]!;
    expect(firstCall[0].name).toBe("foto.png");
    expect(typeof firstCall[1]).toBe("function");
  });

  it("una URL pegada a mano no reporta publicId", () => {
    const onUploaded = vi.fn();
    render(
      <ImageUploader
        onChange={vi.fn()}
        onUploaded={onUploaded}
        uploadImage={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("image-url-input"), {
      target: { value: "https://otra.png" },
    });

    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("acepta imágenes arrastradas sobre la dropzone", async () => {
    const upload = vi.fn(async () => uploaded);
    render(<ImageUploader onChange={vi.fn()} uploadImage={upload} />);

    fireEvent.drop(screen.getByTestId("image-dropzone"), {
      dataTransfer: { files: [makePngFile()] },
    });

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  });

  it("acepta imágenes pegadas con Ctrl+V", async () => {
    const upload = vi.fn(async () => uploaded);
    render(<ImageUploader onChange={vi.fn()} uploadImage={upload} />);

    fireEvent.paste(document, {
      clipboardData: makeClipboardData(makePngFile("pego.png")),
    });

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  });

  it("no roba el paste cuando el foco está en un campo de texto", async () => {
    const upload = vi.fn();
    render(<ImageUploader onChange={vi.fn()} uploadImage={upload} />);

    screen.getByTestId("image-url-input").focus();
    fireEvent.paste(document, {
      clipboardData: makeClipboardData(makePngFile()),
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(upload).not.toHaveBeenCalled();
  });

  it("deja pegar una URL en el campo alternativo", () => {
    const onChange = vi.fn();
    render(<ImageUploader onChange={onChange} uploadImage={vi.fn()} />);

    fireEvent.change(screen.getByTestId("image-url-input"), {
      target: { value: "https://otra.png" },
    });

    expect(onChange).toHaveBeenCalledWith("https://otra.png");
  });

  it("quita la imagen con el botón de la esquina", () => {
    const onChange = vi.fn();
    render(
      <ImageUploader
        value={uploadedUrl}
        onChange={onChange}
        uploadImage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("image-remove"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
