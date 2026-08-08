import type { SystemRole } from "@taskmaster/contracts";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: SystemRole;
}

export interface AuthUser extends JwtPayload {
  [key: string]: unknown;
}
