import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

const AVATAR_URL = "https://cdn.fake/ana.png";

describe("Avatar", () => {
  it("muestra las iniciales cuando no hay foto", () => {
    render(<Avatar name="Ana Pérez" />);

    expect(screen.getByLabelText("Ana Pérez").textContent).toBe("AP");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("muestra la imagen cuando hay una URL", () => {
    render(<Avatar name="Ana Pérez" src={AVATAR_URL} />);

    expect(
      screen.getByRole("img", { name: "Ana Pérez" }).getAttribute("src"),
    ).toBe(AVATAR_URL);
  });

  it("cae a las iniciales si la imagen no carga", () => {
    render(<Avatar name="Ana Pérez" src={AVATAR_URL} />);

    fireEvent.error(screen.getByRole("img", { name: "Ana Pérez" }));

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByLabelText("Ana Pérez").textContent).toBe("AP");
  });

  it("reintenta la imagen cuando cambia la URL después de un error", () => {
    const { rerender } = render(<Avatar name="Ana Pérez" src={AVATAR_URL} />);
    fireEvent.error(screen.getByRole("img", { name: "Ana Pérez" }));

    const nueva = "https://cdn.fake/ana-2.png";
    rerender(<Avatar name="Ana Pérez" src={nueva} />);

    expect(
      screen.getByRole("img", { name: "Ana Pérez" }).getAttribute("src"),
    ).toBe(nueva);
  });
});
