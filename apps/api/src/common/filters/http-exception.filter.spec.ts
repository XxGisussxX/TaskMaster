import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { HttpException, HttpStatus } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { HttpExceptionFilter } from "./http-exception.filter";

type JsonFn = (body: unknown) => void;

/** Mimics the subset of Express' Response that the filter actually touches. */
type FakeResponse = { status: unknown; json: ReturnType<typeof vi.fn<JsonFn>> };

/** El tipo exacto que Nest le pasa al filter: no hace falta replicar la interface. */
type FilterHost = Parameters<HttpExceptionFilter["catch"]>[1];

interface HostHarness {
  host: FilterHost;
  response: FakeResponse;
}

function hostReturning(type = "http"): HostHarness {
  const response: FakeResponse = {
    status: undefined,
    json: vi.fn<JsonFn>(),
  };
  response.status = vi.fn(() => response);

  // El filter solo usa getType() y switchToHttp(); el resto se rellena para
  // satisfacer la interface.
  const host = {
    getType: () => type,
    getArgs: () => [],
    getClass: () => ({}),
    getNext: () => undefined,
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: "/test", method: "POST" }),
    }),
    switchToRpc: () => {
      throw new Error("no rpc en este test");
    },
    switchToWs: () => {
      throw new Error("no ws en este test");
    },
  } as unknown as FilterHost;

  return { host, response };
}

function p2002(meta: Prisma.JsonObject) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta,
  });
}

function bodyOf(filter: HttpExceptionFilter, { host, response }: HostHarness) {
  filter.catch(p2002({ target: ["email"] }), host);
  return response.json.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("HttpExceptionFilter", () => {
  it("no filtra exception.meta de Prisma (P2002)", () => {
    const filter = new HttpExceptionFilter();
    const h = hostReturning();

    const body = bodyOf(filter, h);

    expect(body.statusCode).toBe(HttpStatus.CONFLICT);
    expect(JSON.stringify(body)).not.toContain("target");
    expect(body.errors).toBeUndefined();
  });

  it("no expone el valor que violó el índice único", () => {
    const filter = new HttpExceptionFilter();
    const h = hostReturning();

    const body = bodyOf(filter, h);

    // Si el meta llegara al cliente, un register que choca confirmaría que el
    // email ya está registrado.
    expect(JSON.stringify(body)).not.toContain("violated@example.com");
  });

  it("ignora contextos que no son HTTP (WebSockets) sin lanzar", () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = hostReturning("ws");

    expect(() => filter.catch(new Error("socket"), host)).not.toThrow();
    expect(response.json).not.toHaveBeenCalled();
  });

  it("propaga issues de Zod como array", () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = hostReturning();
    const zodLike = new HttpException(
      { message: "Validación fallida", issues: [{ path: ["email"] }] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(zodLike, host);

    const body = response.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.errors).toEqual([{ path: ["email"] }]);
  });

  it("no propaga message cuando no es string", () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = hostReturning();
    const leaky = new HttpException(
      { message: { secret: "columna users.email" } },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(leaky, host);

    const body = response.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.message).toBe("Solicitud inválida");
    expect(JSON.stringify(body)).not.toContain("columna users.email");
  });
});
