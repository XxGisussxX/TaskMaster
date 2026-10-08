import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL v16 requiere el flag de entorno para que `act` funcione sin advertencias.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});
