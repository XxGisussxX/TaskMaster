import { beforeEach, describe, expect, it } from "vitest";
import { presenceSnapshotSchema } from "@taskmaster/contracts";
import { applyPresenceSnapshot, usePresenceStore } from "./presence.store";

function snapshot(activeUserIds: string[], workspaceId = "ws1") {
  return {
    workspaceId,
    activeUserIds,
    activeCount: activeUserIds.length,
    generatedAt: new Date().toISOString(),
  };
}

describe("store/presence", () => {
  beforeEach(() => {
    usePresenceStore.getState().reset();
  });

  it("arranca sin datos y sin readiness", () => {
    const state = usePresenceStore.getState();

    expect(state.activeUserIds).toEqual([]);
    expect(state.activeCount).toBe(0);
    expect(state.ready).toBe(false);
  });

  it("guarda el snapshot recibido", () => {
    applyPresenceSnapshot(snapshot(["u1", "u2"]), "ws1");

    const state = usePresenceStore.getState();
    expect(state.activeUserIds).toEqual(["u1", "u2"]);
    expect(state.activeCount).toBe(2);
    expect(state.ready).toBe(true);
  });

  it("acepta la lista vacía como cambio válido", () => {
    applyPresenceSnapshot(snapshot(["u1"]), "ws1");
    applyPresenceSnapshot(snapshot([]), "ws1");

    const state = usePresenceStore.getState();
    expect(state.activeCount).toBe(0);
    // `ready` sigue en true: vacía no es "todavía no sabemos".
    expect(state.ready).toBe(true);
  });

  it("ignora el snapshot de otro workspace", () => {
    applyPresenceSnapshot(snapshot(["u1"], "ws2"), "ws1");

    expect(usePresenceStore.getState().ready).toBe(false);
  });

  it("ignora el snapshot sin workspace activo", () => {
    applyPresenceSnapshot(snapshot(["u1"]), null);

    expect(usePresenceStore.getState().ready).toBe(false);
  });

  it("descarta payloads que no cumplen el contrato", () => {
    applyPresenceSnapshot(
      { workspaceId: "ws1", activeUserIds: "u1", activeCount: 1 },
      "ws1",
    );

    // Llega por la red: un payload corrupto no debe romper la pantalla ni
    // dejar la UI en un estado imposible.
    expect(usePresenceStore.getState().ready).toBe(false);
  });

  it("descarta un snapshot con conteo inconsistente", () => {
    applyPresenceSnapshot(
      {
        workspaceId: "ws1",
        activeUserIds: ["u1", "u2"],
        activeCount: 1,
        generatedAt: new Date().toISOString(),
      },
      "ws1",
    );

    expect(usePresenceStore.getState().ready).toBe(false);
  });

  it("reset deja el store listo para un workspace nuevo", () => {
    applyPresenceSnapshot(snapshot(["u1"]), "ws1");
    usePresenceStore.getState().reset();

    const state = usePresenceStore.getState();
    expect(state.activeUserIds).toEqual([]);
    expect(state.generatedAt).toBeNull();
    expect(state.ready).toBe(false);
  });

  it("el contrato acepta el snapshot que genera el backend", () => {
    const parsed = presenceSnapshotSchema.safeParse(snapshot(["u1"], "ws9"));
    expect(parsed.success).toBe(true);
  });

  it("el contrato rechaza ids duplicados", () => {
    const parsed = presenceSnapshotSchema.safeParse(snapshot(["u1", "u1"]));
    expect(parsed.success).toBe(false);
  });
});
