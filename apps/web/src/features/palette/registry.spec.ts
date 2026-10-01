import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePaletteRegistry, type PaletteCommand } from "./registry";

function makeCommand(overrides: Partial<PaletteCommand> = {}): PaletteCommand {
  return {
    id: "cmd.test",
    group: "actions",
    section: "Prueba",
    title: "Comando de prueba",
    run: () => undefined,
    ...overrides,
  };
}

describe("palette/registry", () => {
  beforeEach(() => {
    usePaletteRegistry.setState({ commands: {} });
  });

  it("registra un comando por id", () => {
    const command = makeCommand();
    usePaletteRegistry.getState().registerCommand(command);

    expect(usePaletteRegistry.getState().commands["cmd.test"]).toBe(command);
  });

  it("registrar el mismo comando (mismo id, run y título) es idempotente y conserva la referencia", () => {
    const run = vi.fn();
    const command = makeCommand({ run });

    usePaletteRegistry.getState().registerCommand(command);
    const firstState = usePaletteRegistry.getState();
    usePaletteRegistry.getState().registerCommand(command);
    const secondState = usePaletteRegistry.getState();

    expect(secondState.commands["cmd.test"]).toBe(command);
    expect(secondState.commands).toBe(firstState.commands);
  });

  it("reemplaza un comando existente cuando cambia el run (nueva closure)", () => {
    const original = makeCommand();
    const replacement = makeCommand({ run: () => undefined });

    usePaletteRegistry.getState().registerCommand(original);
    usePaletteRegistry.getState().registerCommand(replacement);

    expect(usePaletteRegistry.getState().commands["cmd.test"]).toBe(
      replacement,
    );
  });

  it("reemplaza un comando existente cuando cambia el título", () => {
    const original = makeCommand();
    const replacement = makeCommand({ title: "Título distinto" });

    usePaletteRegistry.getState().registerCommand(original);
    usePaletteRegistry.getState().registerCommand(replacement);

    expect(usePaletteRegistry.getState().commands["cmd.test"]).toBe(
      replacement,
    );
  });

  it("conserva metadatos condicionales (available, group, section) al registrar", () => {
    const available = vi.fn().mockReturnValue(false);
    const command = makeCommand({
      group: "navigation",
      section: "Navegación",
      available,
    });

    usePaletteRegistry.getState().registerCommand(command);

    const stored = usePaletteRegistry.getState().commands["cmd.test"];
    if (!stored) throw new Error("Comando no registrado");
    expect(stored.available).toBe(available);
    expect(stored.group).toBe("navigation");
    expect(stored.section).toBe("Navegación");
  });

  it("conserva el bucket (workspace/quick) al registrar", () => {
    const command = makeCommand({ bucket: "workspace" });
    usePaletteRegistry.getState().registerCommand(command);

    const stored = usePaletteRegistry.getState().commands["cmd.test"];
    if (!stored) throw new Error("Comando no registrado");
    expect(stored.bucket).toBe("workspace");
  });

  it("desregistra un comando por id", () => {
    const command = makeCommand();
    usePaletteRegistry.getState().registerCommand(command);
    usePaletteRegistry.getState().unregisterCommand("cmd.test");

    expect(usePaletteRegistry.getState().commands).toEqual({});
  });

  it("desregistrar un id inexistente es un no-op y conserva el estado", () => {
    const command = makeCommand();
    usePaletteRegistry.getState().registerCommand(command);
    const before = usePaletteRegistry.getState().commands;

    usePaletteRegistry.getState().unregisterCommand("cmd.missing");

    expect(usePaletteRegistry.getState().commands).toBe(before);
    expect(usePaletteRegistry.getState().commands["cmd.test"]).toBe(command);
  });
});
