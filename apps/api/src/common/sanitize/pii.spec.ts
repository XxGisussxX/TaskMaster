import { describe, expect, it } from "vitest";
import { PII_MASKS, redactPii } from "./pii";

describe("redactPii", () => {
  it("enmascara emails", () => {
    const { text, redacted } = redactPii(
      "Escribime a juan.perez+test@example.com por favor",
    );
    expect(text).toBe(`Escribime a ${PII_MASKS.email} por favor`);
    expect(redacted).toBe(1);
  });

  it("enmascara teléfonos con + o área entre paréntesis", () => {
    const { text } = redactPii(
      "Llamame al +54 9 11 2345-6789 o al (011) 4321-5678",
    );
    expect(text).not.toMatch(/\d/);
    expect(text.match(/\[teléfono\]/g)).toHaveLength(2);
  });

  it("enmascara secuencias largas de dígitos (tarjeta/CUIT)", () => {
    const { text, redacted } = redactPii(
      "Tarjeta 4111111111111111 vence 12/28",
    );
    expect(text).toContain(PII_MASKS.digits);
    expect(redacted).toBe(1);
  });

  it("no toca años, horas ni cantidades cortas", () => {
    const original = "Reunión el 2026-09-18 a las 2026 min";
    const { text, redacted } = redactPii(original);
    expect(text).toBe(original);
    expect(redacted).toBe(0);
  });

  it("devuelve el texto intacto cuando no hay PII", () => {
    const original = "Preparar la presentación del lunes";
    expect(redactPii(original)).toEqual({ text: original, redacted: 0 });
  });

  it("cuenta múltiples ocurrencias", () => {
    const { redacted } = redactPii("a@b.com c@d.com 1234567");
    expect(redacted).toBe(3);
  });
});
