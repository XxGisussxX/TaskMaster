import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of, tap } from "rxjs";
import { WorkspaceRole } from "@taskmaster/contracts";
import { TenantInterceptor } from "./tenant.interceptor";
import { tenantContext, type TenantContext } from "./tenant-context";

function makeContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("TenantInterceptor", () => {
  it("no resuelve membresía ni contexto si falta workspaceId", async () => {
    const access = { assertMembership: vi.fn() };
    const interceptor = new TenantInterceptor(access as never);
    let seen: TenantContext | undefined;
    const next: CallHandler = {
      handle: () => of((seen = tenantContext.get())),
    };

    await lastValueFrom(
      interceptor.intercept(
        makeContext({ params: {}, user: { sub: "u1" } }),
        next,
      ),
    );

    expect(access.assertMembership).not.toHaveBeenCalled();
    expect(seen).toBeUndefined();
  });

  it("no resuelve membresía ni contexto si falta el usuario", async () => {
    const access = { assertMembership: vi.fn() };
    const interceptor = new TenantInterceptor(access as never);
    const next: CallHandler = { handle: () => of(undefined) };

    await lastValueFrom(
      interceptor.intercept(
        makeContext({ params: { workspaceId: "ws1" } }),
        next,
      ),
    );

    expect(access.assertMembership).not.toHaveBeenCalled();
  });

  it("ejecuta el handler con el contexto y rol resueltos", async () => {
    const access = {
      assertMembership: vi
        .fn()
        .mockResolvedValue({ role: WorkspaceRole.ADMIN }),
    };
    const interceptor = new TenantInterceptor(access as never);
    let seen: TenantContext | undefined;
    const next: CallHandler = {
      handle: () =>
        of(undefined).pipe(
          tap(() => {
            seen = tenantContext.get();
          }),
        ),
    };

    await lastValueFrom(
      interceptor.intercept(
        makeContext({ params: { workspaceId: "ws1" }, user: { sub: "u1" } }),
        next,
      ),
    );

    expect(access.assertMembership).toHaveBeenCalledWith("ws1", "u1");
    expect(seen).toEqual({
      userId: "u1",
      workspaceId: "ws1",
      role: WorkspaceRole.ADMIN,
    });
    expect(tenantContext.get()).toBeUndefined();
  });

  it("propaga el error de assertMembership sin ejecutar el handler", async () => {
    const error = new Error("No eres miembro");
    const access = { assertMembership: vi.fn().mockRejectedValue(error) };
    const interceptor = new TenantInterceptor(access as never);
    const handle = vi.fn(() => of(undefined));

    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ params: { workspaceId: "ws1" }, user: { sub: "u1" } }),
          { handle } as CallHandler,
        ),
      ),
    ).rejects.toBe(error);

    expect(handle).not.toHaveBeenCalled();
    expect(tenantContext.get()).toBeUndefined();
  });
});
