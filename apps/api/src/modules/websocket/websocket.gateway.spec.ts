import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import type { Socket } from "socket.io";

// El decorador @WsGateway resuelve el CORS al importar el módulo, antes de que
// exista inyección de dependencias, así que API_ORIGINS tiene que existir antes
// del import. La resolución es fail-closed: sin origins definidos lanza.
// `vi.hoisted` corre antes que los imports, a diferencia de process.env directo.
vi.hoisted(() => {
  process.env.API_ORIGINS ??= "http://localhost:5173";
});

import { AppWebSocketGateway } from "./websocket.gateway";

interface GatewayInternals {
  socketUser: Map<string, string>;
}

function setup(memberExists: boolean) {
  const prisma = {
    workspaceMember: {
      findUnique: vi.fn().mockResolvedValue(memberExists ? { id: "m1" } : null),
    },
  };
  const jwt = { verifyAsync: vi.fn() };
  const gateway = new AppWebSocketGateway(jwt as never, prisma as never);
  return { gateway, prisma };
}

function internals(gateway: AppWebSocketGateway): GatewayInternals {
  return gateway as unknown as GatewayInternals;
}

describe("AppWebSocketGateway.handleJoinWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignora sockets sin usuario autenticado", async () => {
    const { gateway, prisma } = setup(true);
    const join = vi.fn();
    const client = { id: "c1", join } as unknown as Socket;

    await gateway.handleJoinWorkspace({ workspaceId: "ws1" }, client);

    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
  });

  it("rechaza el join si el usuario no es miembro", async () => {
    const { gateway, prisma } = setup(false);
    const join = vi.fn();
    const client = { id: "c1", join } as unknown as Socket;
    internals(gateway).socketUser.set("c1", "user1");

    await expect(
      gateway.handleJoinWorkspace({ workspaceId: "ws1" }, client),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: "ws1", userId: "user1" } },
      select: { id: true },
    });
    expect(join).not.toHaveBeenCalled();
  });

  it("une al socket a la sala si el usuario es miembro", async () => {
    const { gateway } = setup(true);
    const join = vi.fn();
    const client = { id: "c1", join } as unknown as Socket;
    internals(gateway).socketUser.set("c1", "user1");

    await gateway.handleJoinWorkspace({ workspaceId: "ws1" }, client);

    expect(join).toHaveBeenCalledWith("workspace:ws1");
  });
});
