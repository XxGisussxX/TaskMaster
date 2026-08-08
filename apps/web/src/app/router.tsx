import { createBrowserRouter } from "react-router-dom";
import { RequireAuth, RedirectIfAuthed } from "./guards";
import { AppShell } from "@/layouts/AppShell";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { TasksPage } from "@/features/tasks/pages/TasksPage";
import { NotesPage } from "@/features/notes/pages/NotesPage";
import { CalendarPage } from "@/features/calendar/pages/CalendarPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
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
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
