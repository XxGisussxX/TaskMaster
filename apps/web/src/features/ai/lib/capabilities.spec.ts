import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAiCapabilities, resetAiCapabilitiesCache } from "./capabilities";
import { aiApi } from "../api/ai.api";

/**
 * El caché de capabilities es a nivel de módulo a propósito: lo consultan
 * superficies distintas y pegarle el endpoint en cada montaje convertía un
 * detalle de configuración en tráfico por navegación. Estos tests fijan que ese
 * caché no crezca sin control y que degrade al estado conservador.
 */
const CONFIGURED = {
  configured: true,
  model: "gemini-3.6-flash",
  dailyLimit: 15,
};

describe("loadAiCapabilities", () => {
  beforeEach(() => {
    resetAiCapabilitiesCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAiCapabilitiesCache();
  });

  it("consulta una vez y reutiliza la misma promesa", async () => {
    const spy = vi
      .spyOn(aiApi, "getCapabilities")
      .mockResolvedValue(CONFIGURED);

    const [a, b] = await Promise.all([
      loadAiCapabilities("ws1"),
      loadAiCapabilities("ws1"),
    ]);

    expect(a).toBe(b);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("ws1");
  });

  it("no comparte el resultado entre workspaces", async () => {
    const spy = vi
      .spyOn(aiApi, "getCapabilities")
      .mockResolvedValue(CONFIGURED);

    await loadAiCapabilities("ws1");
    await loadAiCapabilities("ws2");
    await loadAiCapabilities("ws1");

    // El endpoint exige membresía: cachear un único resultado global haría que
    // al cambiar de workspace la UI mostrara el estado de uno al que ya no
    // pertenece.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, "ws1");
    expect(spy).toHaveBeenNthCalledWith(2, "ws2");
  });

  it("degrada a 'no configurada' si el endpoint falla", async () => {
    vi.spyOn(aiApi, "getCapabilities").mockRejectedValue(new Error("500"));

    // No se propaga el error: si no sabemos si hay IA, el estado conservador es
    // ocultar el asistente. Asumir lo contrario devolvía el bug que este gate
    // viene a cerrar, un 503 por cada mensaje.
    expect(await loadAiCapabilities("ws1")).toEqual({
      configured: false,
      model: "",
      dailyLimit: 0,
    });
  });

  it("cachea también el fallo, para no reintentar en cada montaje", async () => {
    const spy = vi
      .spyOn(aiApi, "getCapabilities")
      .mockRejectedValue(new Error("500"));

    await loadAiCapabilities("ws1");
    await loadAiCapabilities("ws1");

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
