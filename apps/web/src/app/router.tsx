import { createBrowserRouter } from "react-router-dom";
import { RequireAuth, RequireSystemRole, RedirectIfAuthed } from "./guards";
import { AppShell } from "@/layouts/AppShell";
import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { TasksPage } from "@/features/tasks/pages/TasksPage";
import { NotesPage } from "@/features/notes/pages/NotesPage";
import { CalendarPage } from "@/features/calendar/pages/CalendarPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { AdminPage } from "@/features/admin/pages/AdminPage";
import { AcceptInvitePage } from "@/features/invite/pages/AcceptInvitePage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
import { SystemRole } from "@taskmaster/contracts";
export const router = createBrowserRouter([
  { path: "/invite/:token", element: <AcceptInvitePage /> },
  {
    element: <RedirectIfAuthed />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
          { path: "*", element: <NotFoundPage /> },
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
          { path: "/tasks", element: <TasksPage /> },
          { path: "/notes", element: <NotesPage /> },
          { path: "/calendar", element: <CalendarPage /> },
          { path: "/settings", element: <SettingsPage /> },
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
