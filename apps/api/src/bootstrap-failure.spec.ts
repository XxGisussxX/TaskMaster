import { describe, expect, it } from "vitest";
import { describeBootstrapFailure } from "./bootstrap-failure";

/**
 * Este mensaje es la única ayuda que ve alguien a quien `pnpm dev` no le levanta
 * la API, así que se testea el contenido y no solo que no rompa.
 */
describe("describeBootstrapFailure", () => {
  it("menciona Redis y da el comando para levantarlo", () => {
    const message = describeBootstrapFailure(
      new Error("connect ECONNREFUSED 127.0.0.1:6379"),
    );

    expect(message).toContain("La API no pudo arrancar");
    expect(message).toContain("docker compose up -d redis");
  });

  it("reconoce el error de Redis aunque venga envuelto en un AggregateError", () => {
    // Es la forma real que produce Nest cuando un `onModuleInit` tira.
    const aggregate = new AggregateError([
      new Error("Redis no inicializado"),
      new Error("connect ECONNREFUSED 127.0.0.1:6379"),
    ]);

    const message = describeBootstrapFailure(aggregate);

    expect(message).toContain("docker compose up -d redis");
    expect(message).toContain(
      "Causa raíz: connect ECONNREFUSED 127.0.0.1:6379",
    );
  });

  it("menciona la base de datos cuando el fallo no es de Redis", () => {
    const message = describeBootstrapFailure(
      new Error("Can't reach database server at localhost:5432"),
    );

    expect(message).toContain("docker compose up -d postgres");
    expect(message).not.toContain("up -d redis");
  });

  it("cae a la base si el error no se parece a nada conocido", () => {
    const message = describeBootstrapFailure(new Error("algo raro"));

    expect(message).toContain("La API no pudo arrancar");
    expect(message).toContain("algo raro");
    // Sin pista inventada: es preferible no orientar a mirar Redis si el error
    // no dice nada de Redis.
    expect(message).not.toContain("docker compose");
  });

  it("no rompe con rechazos que no son Error", () => {
    expect(describeBootstrapFailure("texto suelto")).toContain("texto suelto");
    expect(describeBootstrapFailure(undefined)).toContain("undefined");
  });
});
