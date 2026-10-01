import { describe, expect, it, vi } from "vitest";
import { WorkspaceRole } from "@taskmaster/contracts";
import { tenantContext } from "../tenant/tenant-context";
import {
  SCOPED_MODELS,
  TenantContextMissingError,
  scopeArgs,
  tenantExtension,
} from "./tenant.extension";

const WORKSPACE_ID = "ws1";

describe("SCOPED_MODELS", () => {
  it("incluye los modelos con columna workspaceId", () => {
    expect([...SCOPED_MODELS].sort()).toEqual(
      [
        "ActivityLog",
        "AiGeneration",
        "Attachment",
        "Category",
        "CustomFieldDefinition",
        "Invite",
        "Note",
        "Reminder",
        "SavedView",
        "Tag",
        "Task",
        "TaskDependency",
        "TaskTemplate",
        "TimeEntry",
        "WorkspaceMember",
      ].sort(),
    );
  });

  it.each([
    "Comment",
    "CustomFieldValue",
    "Notification",
    "TaskAssignee",
    "TaskTag",
    "User",
    "Workspace",
  ])("excluye %s (sin columna workspaceId o user-scoped)", (model) => {
    expect(SCOPED_MODELS.has(model)).toBe(false);
  });
});

describe("scopeArgs (creates)", () => {
  it("inyecta workspaceId en create.data", () => {
    expect(scopeArgs("create", { data: { title: "t" } }, WORKSPACE_ID)).toEqual(
      {
        data: { title: "t", workspaceId: WORKSPACE_ID },
      },
    );
  });

  it("sobrescribe un workspaceId ajeno provisto por el llamador", () => {
    const args = scopeArgs(
      "create",
      { data: { workspaceId: "evil" } },
      WORKSPACE_ID,
    );
    expect(args.data.workspaceId).toBe(WORKSPACE_ID);
  });

  it("inyecta workspaceId en cada fila de createMany", () => {
    const args = scopeArgs(
      "createMany",
      { data: [{ title: "a" }, { title: "b" }] },
      WORKSPACE_ID,
    );
    expect(args.data).toEqual([
      { title: "a", workspaceId: WORKSPACE_ID },
      { title: "b", workspaceId: WORKSPACE_ID },
    ]);
  });

  it("soporta createMany con data vacío", () => {
    expect(scopeArgs("createMany", {}, WORKSPACE_ID)).toEqual({ data: [] });
  });
});

describe("scopeArgs (where único y listas)", () => {
  it("fusiona workspaceId en findUnique", () => {
    expect(
      scopeArgs("findUnique", { where: { id: "t1" } }, WORKSPACE_ID),
    ).toEqual({ where: { id: "t1", workspaceId: WORKSPACE_ID } });
  });

  it("fusiona workspaceId en update y delete", () => {
    expect(scopeArgs("update", { where: { id: "t1" } }, WORKSPACE_ID)).toEqual({
      where: { id: "t1", workspaceId: WORKSPACE_ID },
    });
    expect(scopeArgs("delete", { where: { id: "t1" } }, WORKSPACE_ID)).toEqual({
      where: { id: "t1", workspaceId: WORKSPACE_ID },
    });
  });

  it("envuelve el where existente en AND para operaciones de lista", () => {
    expect(
      scopeArgs("findMany", { where: { status: "TODO" } }, WORKSPACE_ID),
    ).toEqual({
      where: { AND: [{ status: "TODO" }, { workspaceId: WORKSPACE_ID }] },
    });
  });

  it("crea el where cuando no existe", () => {
    expect(scopeArgs("count", {}, WORKSPACE_ID)).toEqual({
      where: { workspaceId: WORKSPACE_ID },
    });
  });

  it("respeta OR/NOT del llamador al usar AND", () => {
    const where = { OR: [{ a: 1 }, { b: 2 }], NOT: { c: 3 } };
    expect(scopeArgs("findFirst", { where }, WORKSPACE_ID)).toEqual({
      where: { AND: [where, { workspaceId: WORKSPACE_ID }] },
    });
  });

  it("inyecta en create/update y fusiona where en upsert", () => {
    const args = scopeArgs(
      "upsert",
      { where: { id: "t1" }, create: { title: "a" }, update: { title: "b" } },
      WORKSPACE_ID,
    );
    expect(args).toEqual({
      where: { id: "t1", workspaceId: WORKSPACE_ID },
      create: { title: "a", workspaceId: WORKSPACE_ID },
      update: { title: "b", workspaceId: WORKSPACE_ID },
    });
  });
});

describe("tenantExtension", () => {
  function allOperations(): (params: unknown) => Promise<unknown> {
    let config: any;
    const fakeClient = {
      $extends: vi.fn((value: unknown) => {
        config = value;
        return value;
      }),
    };
    (tenantExtension as unknown as (client: unknown) => unknown)(fakeClient);
    return config.query.$allModels.$allOperations;
  }

  it("lanza fail-closed al operar un modelo scoped sin contexto", async () => {
    const operation = allOperations();
    const query = vi.fn(async (args: unknown) => args);

    await expect(
      operation({
        model: "Task",
        operation: "findMany",
        args: { where: { status: "TODO" } },
        query,
      }),
    ).rejects.toBeInstanceOf(TenantContextMissingError);
    expect(query).not.toHaveBeenCalled();
  });

  it("deja pasar modelos fuera de SCOPED_MODELS sin contexto", async () => {
    const operation = allOperations();
    const query = vi.fn(async (args: unknown) => args);
    const args = { where: { id: "u1" } };

    const result = await operation({
      model: "User",
      operation: "findUnique",
      args,
      query,
    });

    expect(query).toHaveBeenCalledWith(args);
    expect(result).toBe(args);
  });

  it("no modifica modelos fuera de SCOPED_MODELS aunque haya contexto", async () => {
    const operation = allOperations();
    const query = vi.fn(async (args: unknown) => args);
    const args = { where: { taskId: "t1" } };

    await tenantContext.run(
      { userId: "u1", workspaceId: WORKSPACE_ID, role: WorkspaceRole.MEMBER },
      () =>
        operation({
          model: "Comment",
          operation: "findMany",
          args,
          query,
        }),
    );

    expect(query).toHaveBeenCalledWith(args);
  });

  it("inyecta workspaceId en modelos scoped cuando hay contexto", async () => {
    const operation = allOperations();
    const query = vi.fn(async (args: unknown) => args);

    await tenantContext.run(
      { userId: "u1", workspaceId: WORKSPACE_ID, role: WorkspaceRole.MEMBER },
      () =>
        operation({
          model: "Task",
          operation: "findUnique",
          args: { where: { id: "t1" } },
          query,
        }),
    );

    expect(query).toHaveBeenCalledWith({
      where: { id: "t1", workspaceId: WORKSPACE_ID },
    });
  });
});
