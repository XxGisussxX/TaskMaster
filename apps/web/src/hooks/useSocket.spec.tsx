import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/store/auth.store";
import { useWorkspaceStore } from "@/store/workspace.store";

const emit = vi.fn();
const on = vi.fn();
const off = vi.fn();
const disconnect = vi.fn();
const connect = vi.fn();

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    connected: true,
    emit,
    on,
    off,
    disconnect,
    connect,
  })),
}));

import { useSocket } from "./useSocket";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function setSession() {
  const now = new Date().toISOString();
  useAuthStore.setState({
    user: {
      id: "u1",
      email: "a@b.c",
      name: "Ana",
      avatarUrl: null,
      role: "USER",
      isEmailVerified: true,
      hasPassword: true,
      createdAt: now,
      updatedAt: now,
    },
    accessToken: "token",
    status: "authenticated",
  });
}

describe("useSocket — salas de workspace", () => {
  beforeEach(() => {
    emit.mockClear();
    on.mockClear();
    off.mockClear();
    disconnect.mockClear();
    connect.mockClear();
    setSession();
    useWorkspaceStore.setState({ currentWorkspaceId: "ws-1" });
  });

  it("se une al workspace activo al conectar", () => {
    renderHook(() => useSocket(), { wrapper });
    expect(emit).toHaveBeenCalledWith("workspace:join", {
      workspaceId: "ws-1",
    });
  });

  it("sale de la sala anterior y entra a la nueva al cambiar de workspace", () => {
    renderHook(() => useSocket(), { wrapper });
    emit.mockClear();

    act(() => {
      useWorkspaceStore.setState({ currentWorkspaceId: "ws-2" });
    });

    expect(emit).toHaveBeenCalledWith("workspace:leave", {
      workspaceId: "ws-1",
    });
    expect(emit).toHaveBeenCalledWith("workspace:join", {
      workspaceId: "ws-2",
    });
  });

  it("sale de la sala cuando se limpia el workspace activo", () => {
    renderHook(() => useSocket(), { wrapper });
    emit.mockClear();

    act(() => {
      useWorkspaceStore.setState({ currentWorkspaceId: null });
    });

    expect(emit).toHaveBeenCalledWith("workspace:leave", {
      workspaceId: "ws-1",
    });
    expect(emit).not.toHaveBeenCalledWith("workspace:join", expect.anything());
  });
});
