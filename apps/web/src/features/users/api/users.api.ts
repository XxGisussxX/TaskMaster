import type { User } from "@taskmaster/contracts";
import { http } from "@/services/http";

export interface UserSettings {
  userId: string;
  theme: string;
  language: string;
  defaultView: string;
  weeklyDigest: boolean;
  emailPrefs: Record<string, boolean>;
  timezone: string;
}

export const usersApi = {
  getProfile: () => http.get<User>("/users/me"),

  updateProfile: (input: { name?: string; avatarUrl?: string | null }) =>
    http.patch<User>("/users/me", input),

  getSettings: () => http.get<UserSettings>("/users/me/settings"),

  updateSettings: (input: Record<string, unknown>) =>
    http.put<UserSettings>("/users/me/settings", input),
};
