import { createBrowserRouter } from "react-router-dom";
import { RequireAuth, RequireSystemRole, RedirectIfAuthed } from "./guards";
import { AppShell } from "@/layouts/AppShell";
import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { OAuthCallbackPage } from "@/features/auth/pages/OAuthCallbackPage";
import { VerifyEmailPage } from "@/features/auth/pages/VerifyEmailPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { TasksPage } from "@/features/tasks/pages/TasksPage";
import { NotesPage } from "@/features/notes/pages/NotesPage";
import { GeneratorPage } from "@/features/documents/pages/GeneratorPage";
import { CalendarPage } from "@/features/calendar/pages/CalendarPage";
import { DreamBoardPage } from "@/features/dream-board/pages/DreamBoardPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { WorkspacePage } from "@/features/workspace/pages/WorkspacePage";
import { AdminPage } from "@/features/admin/pages/AdminPage";
import { AcceptInvitePage } from "@/features/invite/pages/AcceptInvitePage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
import { SystemRole } from "@taskmaster/contracts";
import { LandingPage } from "@/features/landing/pages/LandingPage";

export const router = createBrowserRouter([
  { path: "/invite/:token", element: <AcceptInvitePage /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/", element: <LandingPage /> },
  {
    element: <RedirectIfAuthed />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
          {
            path: "/auth/callback",
            element: <OAuthCallbackPage />,
          },
          { path: "/forgot-password", element: <ForgotPasswordPage /> },
          { path: "/reset-password", element: <ResetPasswordPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/tasks", element: <TasksPage /> },
          { path: "/notes", element: <NotesPage /> },
          { path: "/dream-board", element: <DreamBoardPage /> },
          { path: "/generator", element: <GeneratorPage /> },
          { path: "/calendar", element: <CalendarPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "/workspace", element: <WorkspacePage /> },
          {
            element: (
              <RequireSystemRole
                roles={[SystemRole.ADMIN, SystemRole.SUPER_ADMIN]}
              />
            ),
            children: [{ path: "/admin", element: <AdminPage /> }],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
