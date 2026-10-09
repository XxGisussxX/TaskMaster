import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import {
  channelIdParamsSchema,
  noteIdParamsSchema,
  pinIdParamsSchema,
  savedViewIdParamsSchema,
  tagIdParamsSchema,
  taskIdParamsSchema,
  workspaceIdParamsSchema,
} from "@taskmaster/contracts";
import { describe, expect, it } from "vitest";
import { ParseIdPipe } from "./parse-id.pipe";

/**
 * Regresión: el pipe arma `{ id: value }` antes de validar, así que todo
 * `*ParamsSchema` debe usar la llave `id`. Con `pinId` como llave, cada
 * PATCH/DELETE de pin devolvía 400 "Required" y la posición del drag & drop
 * nunca se guardaba.
 */
const schemas = {
  workspaceIdParamsSchema,
  taskIdParamsSchema,
  noteIdParamsSchema,
  channelIdParamsSchema,
  tagIdParamsSchema,
  savedViewIdParamsSchema,
  pinIdParamsSchema,
};

describe("ParseIdPipe", () => {
  it.each(Object.entries(schemas))(
    "%s acepta el valor del parámetro de ruta",
    (_name, schema) => {
      const pipe = new ParseIdPipe(schema);
      expect(pipe.transform("some-opaque-id")).toBe("some-opaque-id");
    },
  );

  it.each(Object.entries(schemas))(
    "%s rechaza un valor vacío",
    (_name, schema) => {
      const pipe = new ParseIdPipe(schema);
      expect(() => pipe.transform("")).toThrow(BadRequestException);
    },
  );
});
