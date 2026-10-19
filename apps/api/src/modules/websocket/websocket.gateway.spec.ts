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
  const presence = {
    join: vi.fn(),
    leave: vi.fn(),
    disconnect: vi.fn(),
    heartbeat: vi.fn(),
    activeUserIds: vi.fn().mockReturnValue([]),
  };
  const gateway = new AppWebSocketGateway(
    jwt as never,
    prisma as never,
    presence as never,
  );
  return { gateway, prisma, presence };
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

  it("marca presencia al unirse", async () => {
    const { gateway, presence } = setup(true);
    const client = { id: "c1", join: vi.fn() } as unknown as Socket;
    internals(gateway).socketUser.set("c1", "user1");

    await gateway.handleJoinWorkspace({ workspaceId: "ws1" }, client);

    expect(presence.join).toHaveBeenCalledWith("c1", "user1", "ws1");
  });

  it("no marca presencia si el join fue rechazado", async () => {
    const { gateway, presence } = setup(false);
    const client = { id: "c1", join: vi.fn() } as unknown as Socket;
    internals(gateway).socketUser.set("c1", "user1");

    await expect(
      gateway.handleJoinWorkspace({ workspaceId: "ws1" }, client),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Un usuario que no es miembro no puede figurar como activo.
    expect(presence.join).not.toHaveBeenCalled();
  });
});

describe("AppWebSocketGateway.handleLeaveWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saca la presencia del workspace que se abandona", () => {
    const { gateway, presence } = setup(true);
    const leave = vi.fn();
    const client = { id: "c1", leave } as unknown as Socket;
    internals(gateway).socketUser.set("c1", "user1");

    gateway.handleLeaveWorkspace({ workspaceId: "ws1" }, client);

    expect(leave).toHaveBeenCalledWith("workspace:ws1");
    expect(presence.leave).toHaveBeenCalledWith("c1", "user1", "ws1");
  });

  it("no toca la presencia de un socket sin usuario", () => {
    const { gateway, presence } = setup(true);
    const client = { id: "c1", leave: vi.fn() } as unknown as Socket;

    gateway.handleLeaveWorkspace({ workspaceId: "ws1" }, client);

    expect(presence.leave).not.toHaveBeenCalled();
  });
});

describe("AppWebSocketGateway presencia y ciclo de vida", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reenvía el heartbeat al servicio con el id del socket", () => {
    const { gateway, presence } = setup(true);
    const client = { id: "c1" } as unknown as Socket;

    gateway.handleHeartbeat(client);

    expect(presence.heartbeat).toHaveBeenCalledWith("c1");
  });

  it("libera la presencia al desconectar", () => {
    const { gateway, presence } = setup(true);
    const client = { id: "c1" } as unknown as Socket;
    internals(gateway).socketUser.set("c1", "user1");

    gateway.handleDisconnect(client);

    expect(presence.disconnect).toHaveBeenCalledWith("c1");
  });

  it("difunde el snapshot a la sala del workspace cuando cambia", () => {
    const { gateway, presence } = setup(true);
    presence.activeUserIds.mockReturnValue(["u1", "u2"]);
    const emit = vi.fn();
    (gateway as unknown as { server: { to: unknown } }).server = {
      to: vi.fn().mockReturnValue({ emit }),
    };

    gateway.handlePresenceChanged({ workspaceId: "ws1" });

    const { to } = (
      gateway as unknown as { server: { to: (r: string) => unknown } }
    ).server;
    expect(to).toHaveBeenCalledWith("workspace:ws1");
    expect(emit).toHaveBeenCalledWith(
      "presence:snapshot",
      expect.objectContaining({
        workspaceId: "ws1",
        activeUserIds: ["u1", "u2"],
        activeCount: 2,
      }),
    );
  });

  it("difunde una lista vacía en vez de omitir el evento", () => {
    const { gateway, presence } = setup(true);
    presence.activeUserIds.mockReturnValue([]);
    const emit = vi.fn();
    (gateway as unknown as { server: { to: unknown } }).server = {
      to: vi.fn().mockReturnValue({ emit }),
    };

    gateway.handlePresenceChanged({ workspaceId: "ws1" });

    // Sin este evento, un cliente que quedó con un snapshot viejo seguiría
    // mostrando a alguien que ya se fue.
    expect(emit).toHaveBeenCalledWith(
      "presence:snapshot",
      expect.objectContaining({ activeCount: 0, activeUserIds: [] }),
    );
  });
});

describe("AppWebSocketGateway eventos de notas", () => {
  function withServer() {
    const { gateway } = setup(true);
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    (gateway as unknown as { server: { to: unknown } }).server = { to };
    return { gateway, to, emit };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reenvía note.created a la sala del workspace", () => {
    const { gateway, to, emit } = withServer();
    const payload = { workspaceId: "ws1", note: { id: "n1" } };

    gateway.handleNoteCreated(payload);

    expect(to).toHaveBeenCalledWith("workspace:ws1");
    expect(emit).toHaveBeenCalledWith("note:created", payload);
  });

  it("reenvía note.updated a la sala del workspace", () => {
    const { gateway, to, emit } = withServer();
    const payload = { workspaceId: "ws1", note: { id: "n1" } };

    gateway.handleNoteUpdated(payload);

    expect(to).toHaveBeenCalledWith("workspace:ws1");
    expect(emit).toHaveBeenCalledWith("note:updated", payload);
  });

  it("reenvía note.deleted a la sala del workspace", () => {
    const { gateway, to, emit } = withServer();
    const payload = { workspaceId: "ws1", noteId: "n1" };

    gateway.handleNoteDeleted(payload);

    expect(to).toHaveBeenCalledWith("workspace:ws1");
    expect(emit).toHaveBeenCalledWith("note:deleted", payload);
  });
});
