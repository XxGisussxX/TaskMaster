/**
 * Redacción de PII antes de enviar prompts a un proveedor externo (Gemini).
 *
 * El usuario escribe texto libre (descripciones de tareas, mensajes del
 * asistente) que puede contener datos personales. Mandarlo crudo a un tercero
 * los expone sin necesidad: el modelo no necesita un email ni un número de
 * tarjeta para redactar un título de tarea, así que se enmascaran y se anota
 * cuántos se ocultaron.
 *
 * No es un DLP exhaustivo: cubre los patrones de alto valor (emails, teléfonos
 * y secuencias largas de dígitos tipo tarjeta/CUIT/DNI). La decisión de diseño
 * es preferir falsos negativos a falsos positivos que rompan texto legítimo.
 */

/** Marcadores estables: el modelo ve que había un dato, sin el dato. */
export const PII_MASKS = {
  email: "[email]",
  phone: "[teléfono]",
  digits: "[número]",
} as const;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Teléfonos.
 *
 * Exige una señal de formato explícita para no confundir fechas ni horas con
 * teléfonos: un `+` inicial (E.164) o un área entre paréntesis. Sin exigir
 * señal, `2026-09-18` se redactaba como teléfono; preferimos quedarnos cortos
 * antes que romper texto legítimo. Los teléfonos sin `+` ni paréntesis caen
 * igual en el paso de dígitos si son largos.
 */
const PHONE_RE = /(?:\+\d[\d\s().-]{6,}\d|\(\d{2,4}\)[\s.-]?\d[\d\s.-]{4,}\d)/g;

/**
 * Secuencias de 6 o más dígitos (con separadores opcionales) que no matcheó el
 * patrón de teléfono: tarjetas, CUIT/CUIL (11), DNI (7-8), cuentas bancarias.
 * El umbral de 6 deja pasar años, horas y cantidades comunes.
 */
const LONG_DIGITS_RE = /\d{6,}/g;

export interface RedactPiiResult {
  text: string;
  redacted: number;
}

/**
 * Reemplaza emails, teléfonos y secuencias largas de dígitos por marcadores.
 *
 * El orden importa: primero emails (que contienen `@` y no colisionan),
 * después teléfonos (que consumen separadores que el patrón de dígitos sueltos
 * no contempla) y al final dígitos sueltos sobre lo que quede.
 */
export function redactPii(input: string): RedactPiiResult {
  let redacted = 0;
  const count = () => {
    redacted += 1;
  };

  let text = input.replace(EMAIL_RE, () => {
    count();
    return PII_MASKS.email;
  });

  text = text.replace(PHONE_RE, (match) => {
    const digits = match.replace(/\D/g, "");
    // Evita que un número corto (p. ej. "2026") se trate como teléfono.
    if (digits.length < 7) return match;
    count();
    return PII_MASKS.phone;
  });

  // Los marcadores insertados no contienen dígitos, así que este paso solo
  // toca lo que quedó sin enmascarar.
  text = text.replace(LONG_DIGITS_RE, () => {
    count();
    return PII_MASKS.digits;
  });

  return { text, redacted };
}
