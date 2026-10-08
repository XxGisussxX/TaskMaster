import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "./MarkdownEditor";

function linesFromOverlay(container: HTMLElement): string[] {
  const overlay = container.querySelector('pre[aria-hidden="true"]');
  if (!overlay) return [];
  return Array.from(overlay.querySelectorAll("span")).map(
    (span) => span.textContent ?? "",
  );
}

function gutterFromOverlay(container: HTMLElement): string[] {
  const gutter = container.querySelector(
    'div[aria-hidden="true"]',
  ) as HTMLElement;
  if (!gutter) return [];
  return Array.from(gutter.children)
    .flatMap((child) => Array.from(child.children))
    .map((node) => node.textContent ?? "");
}

describe("MarkdownEditor", () => {
  it("alinea visible, líneas lógicas y gutter (una línea en bloque por cada línea)", () => {
    const value = "INFORME\n\n- Punto";
    const { container } = render(
      <MarkdownEditor value={value} onChange={vi.fn()} />,
    );

    const lines = linesFromOverlay(container);
    expect(lines).toEqual(["INFORME", " ", "- Punto"]);
    expect(lines).toHaveLength(3);

    const spans = Array.from(
      container.querySelectorAll('pre[aria-hidden="true"] span'),
    );
    expect(spans.every((span) => span.classList.contains("block"))).toBe(true);

    expect(gutterFromOverlay(container)).toEqual(["1", "2", "3"]);
  });

  it("recalcula el overlay y la gutter al cambiar el contenido", () => {
    function Harness() {
      const [value, setValue] = useState("A\nB");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    const { container } = render(<Harness />);
    expect(linesFromOverlay(container)).toEqual(["A", "B"]);

    fireEvent.change(screen.getByLabelText("Contenido del documento"), {
      target: { value: "Solo\nUna\nLinea" },
    });

    expect(linesFromOverlay(container)).toEqual(["Solo", "Una", "Linea"]);
    expect(gutterFromOverlay(container)).toEqual(["1", "2", "3"]);
  });

  it("propaga el contenido editado por onChange", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Contenido del documento"), {
      target: { value: "Texto nuevo" },
    });

    expect(onChange).toHaveBeenCalledWith("Texto nuevo");
  });
});
