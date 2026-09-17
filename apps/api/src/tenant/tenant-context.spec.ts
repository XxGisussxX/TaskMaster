import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@taskmaster/contracts";
import { tenantContext, type TenantContext } from "./tenant-context";

const CONTEXT: TenantContext = {
  userId: "u1",
  workspaceId: "ws1",
  role: WorkspaceRole.MEMBER,
};

describe("tenantContext", () => {
  it("devuelve undefined fuera de cualquier contexto", () => {
    expect(tenantContext.get()).toBeUndefined();
  });

  it("expone el contexto dentro de run", () => {
    tenantContext.run(CONTEXT, () => {
      expect(tenantContext.get()).toEqual(CONTEXT);
    });
  });

  it("aísla contextos anidados", () => {
    tenantContext.run(CONTEXT, () => {
      tenantContext.run({ ...CONTEXT, workspaceId: "ws2" }, () => {
        expect(tenantContext.get()?.workspaceId).toBe("ws2");
      });
      expect(tenantContext.get()?.workspaceId).toBe("ws1");
    });
  });

  it("propaga el contexto a través de awaits", async () => {
    await tenantContext.run(CONTEXT, async () => {
      await Promise.resolve();
      expect(tenantContext.get()).toEqual(CONTEXT);
    });
  });

  it("no filtra el contexto fuera de run", () => {
    tenantContext.run(CONTEXT, () => {
      expect(tenantContext.get()).toBeDefined();
    });
    expect(tenantContext.get()).toBeUndefined();
  });
});
