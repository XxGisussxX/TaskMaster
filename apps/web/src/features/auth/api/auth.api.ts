import type { AuthSession } from "@taskmaster/contracts";
import { http } from "@/services/http";
import { useAuthStore } from "@/store/auth.store";

export async function login(input: {
  email: string;
  password: string;
}): Promise<void> {
  const session = await http.post<AuthSession>("/auth/login", input);
  useAuthStore.getState().setSession(session);
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  await http.post("/auth/register", input);
}

export function logout(): void {
  void http.post("/auth/logout").catch(() => undefined);
  useAuthStore.getState().clear();
}
